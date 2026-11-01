import { JobRun } from "@/lib/db/models/JobRun";
import { SUPPORT_CONVERSATION_STATUS, SupportConversation } from "@/lib/db/models/SupportConversation";
import { SUPPORT_SENDER_ROLE } from "@/lib/db/models/SupportMessage";
import {
  ADMIN_AUDIENCE,
  NOTIFICATION_ENTITY,
  NOTIFICATION_LIMITS,
  NOTIFICATION_SEVERITY,
  NOTIFICATION_TYPE,
} from "@/lib/constants/notifications";
import { notifyAdmins } from "@/lib/services/notification.service";

const JOB_NAME = "support_unanswered_alerts";
/** Older threads are left to the inbox's "awaiting reply" view rather than re-alerted. */
const LOOKBACK_DAYS = 7;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Raises one admin alert per customer message left without a team reply for
 * longer than SUPPORT_UNANSWERED_ALERT_HOURS. The dedupe key includes the time of
 * the customer's latest message, so re-runs are no-ops and a newer unanswered
 * message alerts again.
 */
export async function runSupportUnansweredAlertsJob({ triggeredBy = "scheduler", batchSize = 100, now = new Date() } = {}) {
  const run = await JobRun.create({ jobName: JOB_NAME, status: "running", startedAt: now, triggeredBy });
  try {
    const cutoff = new Date(now.getTime() - NOTIFICATION_LIMITS.supportUnansweredHours * HOUR_MS);
    const floor = new Date(now.getTime() - LOOKBACK_DAYS * 24 * HOUR_MS);
    const conversations = await SupportConversation.find({
      status: { $in: [SUPPORT_CONVERSATION_STATUS.OPEN, SUPPORT_CONVERSATION_STATUS.IN_PROGRESS] },
      lastMessageRole: SUPPORT_SENDER_ROLE.CUSTOMER,
      lastMessageAt: { $lte: cutoff, $gte: floor },
    })
      .select("subject lastMessageAt")
      .sort({ lastMessageAt: 1 })
      .limit(batchSize)
      .lean();

    const inserted = await notifyAdmins(
      ADMIN_AUDIENCE.SUPPORT,
      conversations.map((conversation) => {
        const hours = Math.floor((now.getTime() - new Date(conversation.lastMessageAt).getTime()) / HOUR_MS);
        return {
          type: NOTIFICATION_TYPE.SUPPORT_UNANSWERED,
          severity: NOTIFICATION_SEVERITY.WARNING,
          title: `Awaiting reply for ${hours}h: ${conversation.subject}`,
          message: "A customer is waiting for a response from the support team.",
          entityType: NOTIFICATION_ENTITY.SUPPORT_CONVERSATION,
          entityId: String(conversation._id),
          url: `/admin/messages/${conversation._id}`,
          dedupeKey: `support:${conversation._id}:unanswered:${new Date(conversation.lastMessageAt).getTime()}`,
        };
      }),
    );

    run.status = "success";
    run.processedCount = inserted.length;
    run.finishedAt = new Date();
    await run.save();
    return run;
  } catch (error) {
    run.status = "failed";
    run.failedCount = 1;
    run.finishedAt = new Date();
    run.errorSummary = String(error?.message ?? error).slice(0, 2000);
    await run.save();
    throw error;
  }
}

export { JOB_NAME as SUPPORT_ALERTS_JOB_NAME };

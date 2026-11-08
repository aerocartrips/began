import { JobRun } from "@/lib/db/models/JobRun";
import { onJobFailed } from "@/lib/notifications/events";

/** A run still "running" after this long is assumed crashed and its lock released. */
const DEFAULT_STALE_LOCK_MS = 15 * 60 * 1000;

/**
 * @typedef {{ processedCount?: number, failedCount?: number, errors?: string[] }} JobTally
 */

/**
 * Runs `work` as one recorded JobRun of `jobName` in the current store, never
 * two at once: the lock is the running JobRun's `lockKey` (unique per store
 * while set), so an overlapping cron call, admin "Run now" or opportunistic
 * trigger is skipped instead of doing the work twice. Admins are alerted when
 * anything failed.
 * @param {string} jobName
 * @param {{ triggeredBy: string, staleLockMs?: number }} options
 * @param {() => Promise<JobTally | number>} work returns its tally, or just the processed count
 * @returns {Promise<import("mongoose").Document & Record<string, any> | { status: "skipped", reason: string }>}
 */
export async function runLockedJob(jobName, { triggeredBy, staleLockMs = DEFAULT_STALE_LOCK_MS }, work) {
  const startedAt = new Date();
  await JobRun.updateMany(
    { lockKey: jobName, startedAt: { $lt: new Date(startedAt.getTime() - staleLockMs) } },
    { $set: { status: "failed", finishedAt: startedAt, errorSummary: "Abandoned: the run did not finish." }, $unset: { lockKey: 1 } },
  );

  let run;
  try {
    run = await JobRun.create({ jobName, status: "running", startedAt, triggeredBy, lockKey: jobName });
  } catch (error) {
    if (error?.code === 11000) return { status: "skipped", reason: "Another run is in progress." };
    throw error;
  }

  try {
    const tally = await work();
    const { processedCount = 0, failedCount = 0, errors = [] } = typeof tally === "number" ? { processedCount: tally } : (tally ?? {});
    run.processedCount = processedCount;
    run.failedCount = failedCount;
    run.status = failedCount > 0 && processedCount === 0 ? "failed" : "success";
    run.errorSummary = errors.slice(0, 5).join(" | ").slice(0, 2000);
  } catch (error) {
    run.status = "failed";
    run.failedCount += 1;
    run.errorSummary = String(error?.message ?? error).slice(0, 2000);
  }
  run.finishedAt = new Date();
  run.lockKey = undefined;
  await run.save();
  if (run.failedCount > 0) onJobFailed(run);
  return run;
}

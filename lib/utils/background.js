import { after } from "next/server";
import { logger } from "@/lib/utils/logger";
import { getTenantContext, runWithTenant } from "@/lib/tenant/context";

/**
 * Runs non-critical work (emails, notifications) after the response is sent.
 * Inside a Next.js request this uses after() so serverless platforms keep the
 * function alive; elsewhere (scripts, tests) it simply runs in the background.
 * The caller's tenant context is captured and restored for the task.
 * Failures are logged, never thrown.
 * @param {string} label
 * @param {() => Promise<unknown>} task
 */
export function runAfterResponse(label, task) {
  const context = getTenantContext();
  const run = () => (context ? runWithTenant(context.tenant ?? context.tenantId, task) : task());
  const guarded = () => Promise.resolve().then(run).catch((error) => logger.warn(`${label} failed`, { error }));
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

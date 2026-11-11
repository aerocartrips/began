import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { resendEmailVerification } from "@/lib/services/auth.service";

/** Emails a new code for the sign-in waiting in this browser (per-account cooldown and hourly limit). */
export const POST = withDatabase(async () => {
  const verification = await resendEmailVerification();
  return successResponse({ verification }, `We sent a new code to ${verification.email}.`);
});

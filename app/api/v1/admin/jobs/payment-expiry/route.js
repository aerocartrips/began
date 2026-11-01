import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { runPaymentExpiryJob } from "@/lib/jobs/payment-expiry.job";

export const POST = withDatabase(async () => {
  await requireAdminAccess();
  const run = await runPaymentExpiryJob({ triggeredBy: "admin" });
  return successResponse(run, "Payment expiry job completed.");
});

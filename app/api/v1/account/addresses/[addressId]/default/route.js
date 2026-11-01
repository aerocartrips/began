import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { setDefaultAddress } from "@/lib/services/address.service";

export const POST = withDatabase(async (request, context) => {
  const user = await requireAuthUser();
  await consumeRateLimit(`account:address:${user._id}`, ACCOUNT_RATE_LIMITS.addressWrite);
  const { addressId } = await context.params;
  const payload = await parseJsonBody(request, 1024);
  const book = await setDefaultAddress(user, addressId, payload);
  return successResponse(book, "Default address updated.");
});

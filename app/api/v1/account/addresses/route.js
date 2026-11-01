import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { createAddress, toAddressBook } from "@/lib/services/address.service";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse(toAddressBook(user), "Addresses fetched.");
});

export const POST = withDatabase(async (request) => {
  const user = await requireAuthUser();
  await consumeRateLimit(`account:address:${user._id}`, ACCOUNT_RATE_LIMITS.addressWrite);
  const payload = await parseJsonBody(request, 8 * 1024);
  const result = await createAddress(user, payload);
  return successResponse(result, "Address saved.", undefined, 201);
});

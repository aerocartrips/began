import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { getAuthUser, requireAuthUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { listCustomerQuotes, submitQuote } from "@/lib/services/quote.service";

const SUBMIT_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };

/** The signed-in buyer's quote requests. */
export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  return successResponse(await listCustomerQuotes(user), "Quotes fetched.");
});

/** Request a quote (signed in or guest). */
export const POST = withDatabase(async (request, { tenant }) => {
  await consumeRateLimit(`quote:${tenant.id}:${getClientIp(request)}`, SUBMIT_RATE_LIMIT, "Too many quote requests. Please try again later.");
  const user = await getAuthUser();
  const quote = await submitQuote(await parseJsonBody(request, 32 * 1024), user);
  return successResponse(quote, "Quote request sent.", undefined, 201);
});

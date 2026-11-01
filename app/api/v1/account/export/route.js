import { withDatabase } from "@/lib/api/with-database";
import { requireAuthUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import { ACCOUNT_RATE_LIMITS } from "@/lib/constants/account";
import { buildAccountExport } from "@/lib/services/account.service";

export const GET = withDatabase(async () => {
  const user = await requireAuthUser();
  await consumeRateLimit(
    `account:export:${user._id}`,
    ACCOUNT_RATE_LIMITS.dataExport,
    "You have downloaded your data several times recently. Please try again later.",
  );
  const data = await buildAccountExport(user);
  const filename = `norosilk-account-data-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});

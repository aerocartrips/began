import { timingSafeEqual, createHash } from "node:crypto";
import { ApiError } from "@/lib/utils/api-error";

export function assertCronSecret(request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    throw new ApiError(503, "CRON_SECRET is not configured.");
  }
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError(401, "Unauthorized cron request.");
  }
}

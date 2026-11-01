import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAuthUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit-guard";
import {
  getStockAlert,
  subscribeStockAlert,
  unsubscribeStockAlert,
} from "@/lib/services/stock-alert.service";

const STOCK_ALERT_RATE_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 };

export const GET = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { productId } = await context.params;
  return successResponse(await getStockAlert(user, productId), "Stock alert fetched.");
});

export const PUT = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  await consumeRateLimit(`stock-alert:${user._id}`, STOCK_ALERT_RATE_LIMIT);
  const { productId } = await context.params;
  return successResponse(await subscribeStockAlert(user, productId), "We will notify you when it is back in stock.");
});

export const DELETE = withDatabase(async (_request, context) => {
  const user = await requireAuthUser();
  const { productId } = await context.params;
  return successResponse(await unsubscribeStockAlert(user, productId), "Stock alert removed.");
});

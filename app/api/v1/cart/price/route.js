import { z } from "zod";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { cartItemSchema } from "@/lib/validators/order.validator";
import { priceCartItems } from "@/lib/services/cart-pricing.service";

const bodySchema = z.object({ items: z.array(cartItemSchema).max(100) });

/** Prices a browser cart with the store's current rules; nothing is stored. */
export const POST = withDatabase(async (request) => {
  const parsed = bodySchema.safeParse(await parseJsonBody(request, 32 * 1024));
  if (!parsed.success) throw new ApiError(422, "Invalid cart.", formatZodErrors(parsed.error));
  return successResponse(await priceCartItems(parsed.data.items), "Cart priced.");
});

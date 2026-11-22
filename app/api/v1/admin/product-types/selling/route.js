import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { parseJsonBody } from "@/lib/api/parse-json";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { ApiError } from "@/lib/utils/api-error";
import { setSellingTypes } from "@/lib/services/product-type.service";

const schema = z.object({
  typeIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(200),
  /** Kinds the store doesn't sell yet, added from their templates (lib/catalog/type-templates.js). */
  templates: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
});

/** What the store sells: the listed types go on sale, every other type is switched off. */
export const PUT = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.CATALOG_MANAGE);
  const parsed = schema.safeParse(await parseJsonBody(request));
  if (!parsed.success) throw new ApiError(422, "Choose the product types to sell.");
  return successResponse(await setSellingTypes(parsed.data.typeIds, parsed.data.templates), "Selling updated.");
});

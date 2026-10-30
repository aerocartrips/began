import { withDatabase } from "@/lib/api/with-database";
import { getAuthUser } from "@/lib/middleware/auth";
import { requireCommerceAdmin } from "@/lib/middleware/admin-api";
import { ROLES } from "@/lib/constants/roles";
import { getOrCreateOrderInvoice } from "@/lib/invoices/invoice.service";
import { ApiError } from "@/lib/utils/api-error";

export const GET = withDatabase(async (_request, context) => {
  const { orderId } = await context.params;
  const sessionUser = await getAuthUser();
  let isAdmin = false;
  /** @type {string | null | undefined} */
  let userId = sessionUser?._id;

  if (!sessionUser) {
    await requireCommerceAdmin();
    isAdmin = true;
    userId = undefined;
  } else if (sessionUser.role === ROLES.ADMIN) {
    isAdmin = true;
  }

  if (!isAdmin && !userId) {
    throw new ApiError(401, "Authentication required.");
  }

  const invoice = await getOrCreateOrderInvoice(orderId, { userId, isAdmin });

  return new Response(invoice.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});

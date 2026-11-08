import { withDatabase } from "@/lib/api/with-database";
import { resolveViewer } from "@/lib/auth/viewer";
import { getOrCreateOrderInvoice } from "@/lib/invoices/invoice.service";

export const GET = withDatabase(async (_request, context) => {
  const { orderId } = await context.params;
  // Any staff member may download invoices; customers only their own.
  const { customer } = await resolveViewer();
  const invoice = await getOrCreateOrderInvoice(orderId, { userId: customer?._id, isAdmin: !customer });

  return new Response(invoice.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});

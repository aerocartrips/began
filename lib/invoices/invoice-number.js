/**
 * @param {{ orderNumber: string, invoice?: { number?: string } | null }} order
 */
export function buildInvoiceNumber(order) {
  if (order.invoice?.number) return order.invoice.number;
  return `INV-${order.orderNumber}`;
}

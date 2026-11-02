/**
 * @param {{ orderNumber: string, invoice?: { number?: string } | null }} order
 */
export function buildInvoiceNumber(order, prefix = "INV") {
  if (order.invoice?.number) return order.invoice.number;
  return `${prefix}-${order.orderNumber}`;
}

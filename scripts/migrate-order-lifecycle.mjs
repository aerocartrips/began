/**
 * One-time backfill for the order lifecycle rules (stock held by paid orders,
 * refunded amounts, delivery dates, legacy return/cancellation requests).
 *
 *   npm run orders:migrate -- --tenant <slug>            # dry run: counts only
 *   npm run orders:migrate -- --tenant <slug> --apply    # write the changes
 *
 * - Paid orders keep holding their stock until they are cancelled; orders paid
 *   before this rule released the flag at payment, so a later cancellation
 *   would not have returned their stock. The flag is set again on them.
 * - amountRefunded is copied from the payment's confirmed refunds, so revenue
 *   figures net out partial refunds.
 * - deliveredAt is taken from the status history (start of the return window).
 * - Cancellation and return requests recorded on orders before service requests
 *   existed are imported (this used to run on every admin Returns page load).
 * Safe to re-run: every step only touches documents that still need it.
 */

import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { Order } from "@/lib/db/models/Order";
import { Payment } from "@/lib/db/models/Payment";
import { runWithTenant } from "@/lib/tenant/context";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants/order-status";
import { migrateLegacyServiceRequestsFromOrders } from "@/lib/services/service-request.service";

const args = parseCli(
  { tenant: { type: "string" }, apply: { type: "boolean" } },
  "Usage: npm run orders:migrate -- --tenant <slug> [--apply]",
);
if (!args.tenant) fail("--tenant is required.");

await connect();
const tenant = await Tenant.findOne({ slug: args.tenant }).lean();
if (!tenant) fail(`No store with slug "${args.tenant}".`);
const apply = Boolean(args.apply);

await runWithTenant(String(tenant._id), async () => {
  const holding = {
    paymentStatus: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED] },
    orderStatus: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED, ORDER_STATUS.PENDING, ORDER_STATUS.PENDING_PAYMENT] },
    inventoryReserved: false,
  };
  const heldCount = await Order.countDocuments(holding);
  if (apply) await Order.updateMany(holding, { $set: { inventoryReserved: true } });
  report("Paid orders now holding their stock", heldCount);

  const refunded = await Order.find({
    paymentStatus: { $in: [PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED] },
    amountRefunded: { $in: [0, null] },
  })
    .select("_id")
    .lean();
  let refundedCount = 0;
  for (const { _id } of refunded) {
    const payment = await Payment.findOne({ order: _id, refundedAmount: { $gt: 0 } }).sort({ createdAt: -1 }).select("refundedAmount").lean();
    if (!payment) continue;
    refundedCount += 1;
    if (apply) await Order.updateOne({ _id }, { $set: { amountRefunded: Math.round(payment.refundedAmount) / 100 } });
  }
  report("Refunded orders with amountRefunded backfilled", refundedCount);

  const delivered = await Order.find({
    deliveredAt: null,
    "statusHistory.newOrderStatus": ORDER_STATUS.DELIVERED,
  })
    .select("statusHistory.newOrderStatus statusHistory.createdAt")
    .lean();
  for (const order of delivered) {
    const entry = order.statusHistory.find((item) => item.newOrderStatus === ORDER_STATUS.DELIVERED);
    if (apply && entry?.createdAt) await Order.updateOne({ _id: order._id }, { $set: { deliveredAt: entry.createdAt } });
  }
  report("Delivered orders with deliveredAt backfilled", delivered.length);

  if (apply) {
    const { imported } = await migrateLegacyServiceRequestsFromOrders();
    report("Legacy service requests imported", imported);
  } else {
    report("Legacy service requests", "imported with --apply");
  }
});

process.stdout.write(apply ? "Done.\n" : "Dry run only. Re-run with --apply to write these changes.\n");
await disconnect();

function report(label, value) {
  process.stdout.write(`${label}: ${value}\n`);
}

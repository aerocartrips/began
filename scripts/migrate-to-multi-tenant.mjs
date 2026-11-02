/**
 * One-time upgrade of a single-store database to multi-tenant.
 *
 *   1. npm run tenant:create -- --slug norosilk --name "Norosilk" --domain norosilk.com --domain localhost
 *   2. npm run tenant:migrate -- --tenant norosilk
 *
 * Assigns every existing document without a tenantId to that store, copies the
 * old StoreSettings contact/business details and env tax/shipping settings onto
 * the store, makes existing admins owners, backfills catalogue search fields,
 * and rebuilds indexes (dropping the old global unique indexes). Safe to re-run.
 */

import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { Address } from "@/lib/db/models/Address";
import { Attribute } from "@/lib/db/models/Attribute";
import { Quote } from "@/lib/db/models/Quote";
import { StorePage } from "@/lib/db/models/StorePage";
import { Cart } from "@/lib/db/models/Cart";
import { Category } from "@/lib/db/models/Category";
import { JobRun } from "@/lib/db/models/JobRun";
import { Notification } from "@/lib/db/models/Notification";
import { Order } from "@/lib/db/models/Order";
import { Payment } from "@/lib/db/models/Payment";
import { PaymentWebhookEvent } from "@/lib/db/models/PaymentWebhookEvent";
import { Product } from "@/lib/db/models/Product";
import { Review } from "@/lib/db/models/Review";
import { ReviewVote } from "@/lib/db/models/ReviewVote";
import { ServiceRequest } from "@/lib/db/models/ServiceRequest";
import { StockAlert } from "@/lib/db/models/StockAlert";
import { StoreSettings } from "@/lib/db/models/StoreSettings";
import { SupportConversation } from "@/lib/db/models/SupportConversation";
import { SupportMessage } from "@/lib/db/models/SupportMessage";
import { User } from "@/lib/db/models/User";
import { Wishlist } from "@/lib/db/models/Wishlist";

const TENANT_MODELS = [
  Address, Attribute, Cart, Category, JobRun, Notification, Order, Payment, PaymentWebhookEvent, Product,
  Quote, Review, ReviewVote, ServiceRequest, StockAlert, StorePage, StoreSettings, SupportConversation, SupportMessage, User, Wishlist,
];

const args = parseCli({ tenant: { type: "string" } }, "Usage: npm run tenant:migrate -- --tenant <slug>");
if (!args.tenant) fail("--tenant is required (create the store first with npm run tenant:create).");

await connect();
const tenant = await Tenant.findOne({ slug: args.tenant });
if (!tenant) fail(`No store with slug "${args.tenant}".`);
const tenantId = tenant._id;

// Raw collection access on purpose: these documents have no tenant yet.
for (const Model of TENANT_MODELS) {
  const { modifiedCount } = await Model.collection.updateMany(
    { tenantId: { $exists: false } },
    { $set: { tenantId } },
  );
  process.stdout.write(`${Model.modelName.padEnd(20)} assigned ${modifiedCount}\n`);
}

const admins = await User.collection.updateMany(
  { tenantId, role: "admin", adminRole: { $exists: false } },
  { $set: { adminRole: "owner" } },
);
process.stdout.write(`Existing admins promoted to owner: ${admins.modifiedCount}\n`);

const settings = await StoreSettings.collection.findOne({ tenantId });
if (settings?.general || settings?.business) {
  const copy = {
    "contact.email": settings.general?.supportEmail,
    "contact.phone": settings.general?.supportPhone,
    "contact.address": settings.general?.businessAddress,
    "business.legalName": settings.business?.legalName,
    "business.gstin": settings.business?.gstin,
    "business.registeredAddress": settings.business?.registeredAddress,
    "business.invoicePrefix": settings.business?.invoicePrefix,
  };
  const $set = Object.fromEntries(Object.entries(copy).filter(([, value]) => value));
  if (Object.keys($set).length) await Tenant.updateOne({ _id: tenantId }, { $set });
  process.stdout.write(`Copied ${Object.keys($set).length} store detail(s) from StoreSettings.\n`);
}

// Tax and shipping used to come from env; they are per store now.
const commerce = Object.fromEntries(
  [
    ["commerce.defaultGstRatePercent", process.env.TAX_RATE_PERCENT],
    ["commerce.shippingFlatAmount", process.env.SHIPPING_FLAT_AMOUNT],
    ["commerce.shippingFreeThreshold", process.env.SHIPPING_FREE_THRESHOLD],
    ["commerce.lowStockThreshold", process.env.LOW_STOCK_THRESHOLD],
    ["orders.paymentReservationMinutes", process.env.PAYMENT_RESERVATION_MINUTES],
  ]
    .filter(([, value]) => value !== undefined && value !== "" && Number.isFinite(Number(value)))
    .map(([path, value]) => [path, Number(value)]),
);
if (Object.keys(commerce).length) {
  await StoreSettings.collection.updateOne({ tenantId, key: "store" }, { $set: commerce }, { upsert: true });
  process.stdout.write(`Copied ${Object.keys(commerce).length} tax/shipping setting(s) from env.
`);
}

// Sold-out products stay listed now (availability comes from stock), and names are indexed for search.
const restored = await Product.collection.updateMany({ tenantId, status: "out_of_stock" }, { $set: { status: "active" } });
const named = await Product.collection.updateMany({ tenantId, nameLower: { $exists: false } }, [{ $set: { nameLower: { $toLower: "$name" } } }]);
process.stdout.write(`Products relisted: ${restored.modifiedCount}; search names backfilled: ${named.modifiedCount}
`);

for (const Model of [Tenant, ...TENANT_MODELS]) {
  const dropped = await Model.syncIndexes();
  process.stdout.write(`${Model.modelName.padEnd(20)} indexes synced${dropped.length ? `, dropped: ${dropped.join(", ")}` : ""}\n`);
}

await disconnect();
process.stdout.write(`Done. Existing data now belongs to "${tenant.slug}".\n`);


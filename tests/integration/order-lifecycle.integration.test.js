/**
 * Order, payment and stock lifecycle through the real route handlers and
 * services, against an in-memory MongoDB replica set (transactions). Only
 * Razorpay and email delivery are mocked. Each block guards a defect found in
 * the November 2026 audit: retry oversell, stranded stock, unpaid-capture
 * cancellations, broken returns, customer data exposure, staff sign-in through
 * the storefront, lost stock updates, revenue that counted unpaid orders,
 * invoice numbering, and the missing password reset.
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createTestTenant, enterTenantBeforeEach } from "../helpers/tenant.js";
import { signInto } from "../helpers/auth.js";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

let testTenantId;
enterTenantBeforeEach(() => testTenantId);

const KEY_SECRET = "rzp_test_secret_for_lifecycle";
const WEBHOOK_SECRET = "rzp_webhook_secret_for_lifecycle";
const PASSWORD = "Silk-Route-2026";

const cookieJar = new Map();
const razorpay = { payments: new Map(), refunds: [], orderSeq: 0, failNextOrderCreate: false, failFetchPayments: false };
const emails = [];
/** Work scheduled with `after()`; awaited at the end of each simulated request. */
const afterTasks = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name, value) => cookieJar.set(name, value),
    delete: (name) => cookieJar.delete(name),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal()),
  ...(await import("../stubs/next-server.js")),
  after: (task) => afterTasks.push(Promise.resolve().then(typeof task === "function" ? task : () => task)),
}));
vi.mock("@/lib/razorpay/client", () => ({
  getRazorpayClient: () => ({
    orders: {
      create: async ({ amount, currency }) => {
        if (razorpay.failNextOrderCreate) {
          razorpay.failNextOrderCreate = false;
          throw new Error("Razorpay is unavailable (simulated)");
        }
        return { id: `order_L${++razorpay.orderSeq}`, amount, currency };
      },
      fetchPayments: async (orderId) => {
        if (razorpay.failFetchPayments) throw new Error("Razorpay is unavailable (simulated)");
        return { items: [...razorpay.payments.values()].filter((payment) => payment.order_id === orderId) };
      },
    },
    payments: {
      fetch: async (id) => {
        const payment = razorpay.payments.get(id);
        if (!payment) throw new Error("payment not found");
        return payment;
      },
      refund: async (paymentId, { amount }) => {
        const refund = { id: `rfnd_L${razorpay.refunds.length + 1}`, paymentId, amount };
        razorpay.refunds.push(refund);
        return refund;
      },
    },
  }),
}));
vi.mock("@/lib/services/email.service", async (importOriginal) => ({
  ...(await importOriginal()),
  isCustomerEmailConfigured: () => true,
  sendPasswordResetEmail: async (message) => {
    emails.push(message);
    return { sent: true };
  },
}));

const ADDRESS = {
  fullName: "Asha Buyer",
  phone: "9876543210",
  addressLine1: "12 Silk Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  country: "India",
};

let replSet;
let models;
let routes;
let notifications;
let expiryJob;
let category;
let seq = 0;

async function createUser(role = "customer", extra = {}) {
  seq += 1;
  return models.User.create({
    name: `${role} ${seq}`,
    email: `lifecycle-${role}-${seq}-${Date.now()}@norosilk.test`,
    password: await bcrypt.hash(PASSWORD, 4),
    role,
    // Email delivery is "configured" in this suite, so storefront sessions need a verified address.
    isEmailVerified: true,
    ...(role === "admin" ? { adminRole: "owner" } : {}),
    ...extra,
  });
}

async function createProduct(stockQuantity = 10) {
  seq += 1;
  return models.Product.create({
    name: `Kanjivaram ${seq}`,
    slug: `kanjivaram-lifecycle-${seq}-${Date.now()}`,
    sku: `LC-${seq}-${Date.now()}`,
    category: category._id,
    price: 1000,
    wholesalePrice: 800,
    minimumOrderQuantity: 1,
    stockQuantity,
    status: "active",
  });
}

async function call(handler, { as, token, method = "GET", path = "/api/v1/test", body, rawBody, headers = {}, params = {} } = {}) {
  cookieJar.clear();
  if (token) cookieJar.set(ACCESS_COOKIE, token);
  else if (as) await signInto(cookieJar, as);
  const init = { method, headers: { "content-type": "application/json", ...headers } };
  if (rawBody !== undefined) init.body = rawBody;
  else if (body !== undefined) init.body = JSON.stringify(body);
  const response = await handler(new Request(`http://localhost${path}`, init), { params: Promise.resolve(params) });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  await settleBackgroundWork();
  return { status: response.status, json, text };
}

async function settleBackgroundWork() {
  while (afterTasks.length) await Promise.all(afterTasks.splice(0));
  await notifications.flushNotifications();
}

async function checkout(customer, product, quantity) {
  const result = await call(routes.createOrder.POST, {
    as: customer,
    method: "POST",
    body: { items: [{ productId: String(product._id), quantity }], shippingAddress: ADDRESS },
  });
  return result;
}

async function startCheckout(customer, product, quantity) {
  const result = await checkout(customer, product, quantity);
  expect(result.status).toBe(201);
  return result.json.data;
}

function captureAtRazorpay(checkoutData, paymentId) {
  razorpay.payments.set(paymentId, {
    id: paymentId,
    order_id: checkoutData.razorpayOrderId,
    amount: checkoutData.amount,
    currency: "INR",
    status: "captured",
    method: "upi",
  });
}

function verify(customer, checkoutData, paymentId) {
  return call(routes.verify.POST, {
    as: customer,
    method: "POST",
    body: {
      razorpay_order_id: checkoutData.razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: createHmac("sha256", KEY_SECRET).update(`${checkoutData.razorpayOrderId}|${paymentId}`).digest("hex"),
    },
  });
}

function webhook(eventId, payload) {
  const rawBody = JSON.stringify({ id: eventId, ...payload });
  return call(routes.webhook.POST, {
    method: "POST",
    rawBody,
    headers: { "x-razorpay-event-id": eventId, "x-razorpay-signature": createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex") },
  });
}

const captureWebhook = (checkoutData, paymentId) =>
  webhook(`evt_capture_${paymentId}`, {
    event: "payment.captured",
    payload: { payment: { entity: { id: paymentId, order_id: checkoutData.razorpayOrderId } } },
  });

async function paidCheckout(customer, product, quantity) {
  const data = await startCheckout(customer, product, quantity);
  const paymentId = `pay_${data.razorpayOrderId}`;
  captureAtRazorpay(data, paymentId);
  expect((await verify(customer, data, paymentId)).status).toBe(200);
  return { ...data, paymentId };
}

async function expireNow(orderId) {
  await models.Order.updateOne({ _id: orderId }, { $set: { paymentExpiresAt: new Date(Date.now() - 1000) } });
  const run = await expiryJob.runPaymentExpiryJob({ triggeredBy: "test" });
  await settleBackgroundWork();
  return run;
}

const stockOf = async (product) => (await models.Product.findById(product._id).lean()).stockQuantity;
const orderOf = (id) => models.Order.findById(id).lean();

/** Admin moves an order through fulfilment to delivered. */
async function deliver(admin, orderId) {
  for (const orderStatus of ["processing", "packed", "shipped", "delivered"]) {
    const result = await call(routes.orderStatus.PATCH, { as: admin, method: "PATCH", params: { orderId }, body: { orderStatus } });
    expect(result.status).toBe(200);
  }
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("norosilk_lifecycle_test");
  await (await import("@/lib/db/connect")).connectDB();
  const { encryptSecret } = await import("@/lib/tenant/secrets");
  ({ tenantId: testTenantId } = await createTestTenant({
    integrations: { razorpay: { keyId: "rzp_test_key", keySecret: encryptSecret(KEY_SECRET), webhookSecret: encryptSecret(WEBHOOK_SECRET) } },
  }));

  models = {
    User: (await import("@/lib/db/models/User")).User,
    Product: (await import("@/lib/db/models/Product")).Product,
    Category: (await import("@/lib/db/models/Category")).Category,
    Order: (await import("@/lib/db/models/Order")).Order,
    Payment: (await import("@/lib/db/models/Payment")).Payment,
    ServiceRequest: (await import("@/lib/db/models/ServiceRequest")).ServiceRequest,
    StockMovement: (await import("@/lib/db/models/StockMovement")).StockMovement,
    StoreSettings: (await import("@/lib/db/models/StoreSettings")).StoreSettings,
    Counter: (await import("@/lib/db/models/Counter")).Counter,
    Notification: (await import("@/lib/db/models/Notification")).Notification,
    PaymentWebhookEvent: (await import("@/lib/db/models/PaymentWebhookEvent")).PaymentWebhookEvent,
    JobRun: (await import("@/lib/db/models/JobRun")).JobRun,
  };
  // Unique indexes back the idempotency guarantees under test.
  await Promise.all(Object.values(models).map((model) => model.init()));

  notifications = await import("@/lib/services/notification.service");
  expiryJob = await import("@/lib/jobs/payment-expiry.job");
  category = await models.Category.create({ name: "Silk sarees", slug: `silk-lifecycle-${Date.now()}` });
  routes = {
    createOrder: await import("@/app/api/v1/payments/create-order/route"),
    verify: await import("@/app/api/v1/payments/verify/route"),
    webhook: await import("@/app/api/v1/payments/webhook/route"),
    orders: await import("@/app/api/v1/orders/route"),
    orderDetail: await import("@/app/api/v1/orders/[orderId]/route"),
    orderStatus: await import("@/app/api/v1/orders/[orderId]/status/route"),
    cancel: await import("@/app/api/v1/orders/[orderId]/cancel/route"),
    returnRequest: await import("@/app/api/v1/orders/[orderId]/return-request/route"),
    invoice: await import("@/app/api/v1/orders/[orderId]/invoice/route"),
    serviceRequest: await import("@/app/api/v1/admin/service-requests/[requestId]/route"),
    product: await import("@/app/api/v1/products/[productId]/route"),
    customer: await import("@/app/api/v1/customers/[customerId]/route"),
    customers: await import("@/app/api/v1/customers/route"),
    login: await import("@/app/api/v1/auth/login/route"),
    forgotPassword: await import("@/app/api/v1/auth/forgot-password/route"),
    resetPassword: await import("@/app/api/v1/auth/reset-password/route"),
    profile: await import("@/app/api/v1/account/profile/route"),
  };
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

describe("payment attempts and late payments", () => {
  it("keeps the order and its stock after a failed attempt, so a retry on the same Razorpay order confirms it", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct(10)]);
    const data = await startCheckout(customer, product, 4);
    expect(await stockOf(product)).toBe(6);

    await webhook(`evt_fail_${data.razorpayOrderId}`, {
      event: "payment.failed",
      payload: { payment: { entity: { id: `pay_declined_${seq}`, order_id: data.razorpayOrderId, error_description: "Card declined" } } },
    });
    expect(await orderOf(data.internalOrderId)).toMatchObject({ orderStatus: "pending_payment", paymentStatus: "pending", inventoryReserved: true });
    expect(await stockOf(product)).toBe(6);

    const retry = `pay_retry_${seq}`;
    captureAtRazorpay(data, retry);
    expect((await verify(customer, data, retry)).status).toBe(200);

    const order = await orderOf(data.internalOrderId);
    expect(order).toMatchObject({ orderStatus: "confirmed", paymentStatus: "paid", inventoryReserved: true });
    expect(order.invoice.number).toMatch(/^INV\/\d{2}-\d{2}\/\d{5}$/);
    expect(await stockOf(product)).toBe(6);
  });

  it("confirms a payment the browser never reported instead of cancelling the order at expiry", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct(5)]);
    const data = await startCheckout(customer, product, 2);
    captureAtRazorpay(data, `pay_silent_${seq}`); // tab closed: no verify call, webhook not delivered yet

    await expireNow(data.internalOrderId);

    expect(await orderOf(data.internalOrderId)).toMatchObject({ orderStatus: "confirmed", paymentStatus: "paid" });
    expect(await stockOf(product)).toBe(3);
  });

  it("reinstates an expired order when its payment arrives and the stock is still there", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct(5)]);
    const data = await startCheckout(customer, product, 2);
    await expireNow(data.internalOrderId);
    expect(await orderOf(data.internalOrderId)).toMatchObject({ orderStatus: "cancelled", inventoryReserved: false });
    expect(await stockOf(product)).toBe(5);

    const paymentId = `pay_late_${seq}`;
    captureAtRazorpay(data, paymentId);
    expect((await captureWebhook(data, paymentId)).status).toBe(200);

    expect(await orderOf(data.internalOrderId)).toMatchObject({ orderStatus: "confirmed", paymentStatus: "paid", inventoryReserved: true });
    expect(await stockOf(product)).toBe(3);
    const reasons = (await models.StockMovement.find({ order: data.internalOrderId }).sort({ createdAt: 1 }).lean()).map((entry) => entry.reason);
    expect(reasons).toEqual(["order_reserved", "order_released", "order_reinstated"]);
  });

  it("keeps a late-paid order cancelled and refunds it in full when its stock has been sold", async () => {
    const [first, second, product] = await Promise.all([createUser(), createUser(), createProduct(2)]);
    const late = await startCheckout(first, product, 2);
    await expireNow(late.internalOrderId);
    await startCheckout(second, product, 2);
    expect(await stockOf(product)).toBe(0);

    const paymentId = `pay_too_late_${seq}`;
    captureAtRazorpay(late, paymentId);
    expect((await captureWebhook(late, paymentId)).status).toBe(200);

    const order = await orderOf(late.internalOrderId);
    expect(order).toMatchObject({ orderStatus: "cancelled", paymentStatus: "paid" });
    expect(order.cancellationRefund).toMatchObject({ status: "pending" });
    expect(razorpay.refunds.at(-1)).toMatchObject({ paymentId, amount: late.amount });
    expect(await stockOf(product)).toBe(0);
  });

  it("refunds a payment for an order the customer cancelled instead of reinstating it", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct(5)]);
    const data = await startCheckout(customer, product, 1);
    const cancelled = await call(routes.cancel.POST, { as: customer, method: "POST", params: { orderId: data.internalOrderId }, body: { reason: "Changed my mind" } });
    expect(cancelled.status).toBe(200);

    const paymentId = `pay_after_cancel_${seq}`;
    captureAtRazorpay(data, paymentId);
    await captureWebhook(data, paymentId);

    expect(await orderOf(data.internalOrderId)).toMatchObject({ orderStatus: "cancelled", paymentStatus: "paid", cancellationRefund: { status: "pending" } });
    expect(await stockOf(product)).toBe(5);
  });
});

describe("stock is never stranded", () => {
  it("creates orders only through checkout, which also starts the payment", () => {
    expect(routes.orders.POST).toBeUndefined();
  });

  it("cancels the order and frees its stock at once when the payment cannot be started", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct(7)]);
    razorpay.failNextOrderCreate = true;
    const result = await checkout(customer, product, 3);
    expect(result.status).toBe(502);

    const orders = await models.Order.find({ customer: customer._id }).lean();
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ orderStatus: "cancelled", inventoryReserved: false });
    expect(await stockOf(product)).toBe(7);
  });

  it("resumes the unpaid order when the same checkout is paid again, holding the stock once", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct(5)]);
    const first = await startCheckout(customer, product, 3);
    const again = await startCheckout(customer, product, 3);
    expect(again).toMatchObject({ internalOrderId: first.internalOrderId, razorpayOrderId: first.razorpayOrderId });
    expect(await stockOf(product)).toBe(2);
  });

  it("cancels expired orders without a payment, and retries an order whose check failed once its claim lapses", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct(6)]);
    const noPayment = await startCheckout(customer, product, 1);
    await models.Payment.deleteMany({ order: noPayment.internalOrderId });
    await expireNow(noPayment.internalOrderId);
    expect(await orderOf(noPayment.internalOrderId)).toMatchObject({ orderStatus: "cancelled", inventoryReserved: false });

    const other = await startCheckout(customer, product, 2);
    razorpay.failFetchPayments = true;
    const failed = await expireNow(other.internalOrderId);
    expect([failed.status, failed.failedCount]).toEqual(["failed", 1]);
    expect(await orderOf(other.internalOrderId)).toMatchObject({ orderStatus: "pending_payment", inventoryReserved: true });

    razorpay.failFetchPayments = false;
    await expiryJob.runPaymentExpiryJob({ triggeredBy: "test" });
    expect((await orderOf(other.internalOrderId)).orderStatus).toBe("pending_payment"); // claim still held

    await models.Order.updateOne({ _id: other.internalOrderId }, { $set: { paymentExpiryProcessedAt: new Date(Date.now() - 11 * 60 * 1000) } });
    await expiryJob.runPaymentExpiryJob({ triggeredBy: "test" });
    expect(await orderOf(other.internalOrderId)).toMatchObject({ orderStatus: "cancelled", inventoryReserved: false });
    expect(await stockOf(product)).toBe(6);
  });
});

describe("cancellations and returns", () => {
  it("returns the stock of a cancelled paid order, refunds it and opens a request the admin can view", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct(10)]);
    const order = await paidCheckout(customer, product, 3);
    expect(await stockOf(product)).toBe(7);

    const result = await call(routes.cancel.POST, { as: customer, method: "POST", params: { orderId: order.internalOrderId }, body: { reason: "Ordered the wrong colour" } });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ orderStatus: "cancelled", cancellationRefund: { status: "pending" } });
    expect(await stockOf(product)).toBe(10);

    const request = await models.ServiceRequest.findOne({ order: order.internalOrderId }).lean();
    const detail = await call(routes.serviceRequest.GET, { as: admin, params: { requestId: String(request._id) } });
    expect(detail.status).toBe(200);
    expect(detail.json.data).toMatchObject({ type: "cancellation" });
  });

  it("returns the stock, refunds and tells the customer when the store cancels a paid order", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct(10)]);
    const order = await paidCheckout(customer, product, 2);
    const result = await call(routes.orderStatus.PATCH, {
      as: admin,
      method: "PATCH",
      params: { orderId: order.internalOrderId },
      body: { orderStatus: "cancelled", remarks: "Weaver could not deliver this colour", customerVisibleRemark: "Sorry, this saree is no longer available." },
    });
    expect(result.status).toBe(200);
    expect(await stockOf(product)).toBe(10);
    expect(await orderOf(order.internalOrderId)).toMatchObject({ orderStatus: "cancelled", cancellationRefund: { status: "pending" } });
    const statusNotes = await models.Notification.find({ recipientId: customer._id, type: "order_status_changed" }).lean();
    expect(statusNotes.map((note) => note.metadata?.status)).toContain("cancelled");
  });

  it("enforces the store's cancellation and return windows", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct(10)]);
    await models.StoreSettings.updateOne({ key: "store" }, { $set: { "orders.cancellationWindowHours": 1, "orders.returnWindowDays": 7 } }, { upsert: true });

    const late = await paidCheckout(customer, product, 1);
    // createdAt is immutable through Mongoose; age the order directly.
    await models.Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(late.internalOrderId) }, { $set: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    const view = await call(routes.orderDetail.GET, { as: customer, params: { orderId: late.internalOrderId } });
    expect(view.json.data.order.actions).toMatchObject({ canCancel: false });
    const refused = await call(routes.cancel.POST, { as: customer, method: "POST", params: { orderId: late.internalOrderId }, body: { reason: "Too late now" } });
    expect(refused.status).toBe(409);
    expect(refused.json.message).toMatch(/window/);

    await deliver(admin, late.internalOrderId);
    await models.Order.updateOne({ _id: late.internalOrderId }, { $set: { deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } });
    const tooLate = await call(routes.returnRequest.POST, { as: customer, method: "POST", params: { orderId: late.internalOrderId }, body: { reason: "Colour differs" } });
    expect(tooLate.status).toBe(409);

    await models.Order.updateOne({ _id: late.internalOrderId }, { $set: { deliveredAt: new Date() } });
    const accepted = await call(routes.returnRequest.POST, { as: customer, method: "POST", params: { orderId: late.internalOrderId }, body: { reason: "Colour differs" } });
    expect(accepted.status).toBe(201);
    await models.StoreSettings.updateOne({ key: "store" }, { $set: { "orders.cancellationWindowHours": 48, "orders.returnWindowDays": 7 } });
  });

  it("carries the admin's return decision to the customer's order", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct(10)]);
    const order = await paidCheckout(customer, product, 1);
    await deliver(admin, order.internalOrderId);
    await call(routes.returnRequest.POST, { as: customer, method: "POST", params: { orderId: order.internalOrderId }, body: { reason: "Damaged border" } });
    const request = await models.ServiceRequest.findOne({ order: order.internalOrderId, type: "return" }).lean();
    const decide = (body) => call(routes.serviceRequest.PATCH, { as: admin, method: "PATCH", params: { requestId: String(request._id) }, body });

    expect((await decide({ status: "approved", remarks: "Pickup booked" })).status).toBe(200);
    expect(await orderOf(order.internalOrderId)).toMatchObject({ orderStatus: "return_requested", returnRequest: { status: "approved" } });

    expect((await decide({ initiateRefund: true, remarks: "Refund for damaged border" })).status).toBe(200);
    const refunded = await orderOf(order.internalOrderId);
    expect(refunded).toMatchObject({ orderStatus: "returned" });
    const history = await models.ServiceRequest.findById(request._id).lean();
    expect(history.statusHistory.at(-1)).toMatchObject({ changedByLabel: admin.email });
  });
});

describe("customer data and staff access", () => {
  it("shows customers their order without internal notes, staff remarks or staff identities", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct(10)]);
    const order = await paidCheckout(customer, product, 1);
    await call(routes.orderStatus.PATCH, {
      as: admin,
      method: "PATCH",
      params: { orderId: order.internalOrderId },
      body: { orderStatus: "processing", internalNotes: "Buyer haggles; verify GSTIN", remarks: "Picked from rack B", customerVisibleRemark: "We are preparing your order." },
    });

    const detail = await call(routes.orderDetail.GET, { as: customer, params: { orderId: order.internalOrderId } });
    expect(detail.status).toBe(200);
    for (const secret of ["Buyer haggles", "Picked from rack B", admin.email, "internalNotes", "changedBy"]) {
      expect(detail.text).not.toContain(secret);
    }
    expect(detail.text).toContain("We are preparing your order.");
    expect(detail.json.data.order.actions).toBeDefined();

    const adminView = await call(routes.orderDetail.GET, { as: admin, params: { orderId: order.internalOrderId } });
    expect(adminView.json.data.order.internalNotes).toBe("Buyer haggles; verify GSTIN");
  });

  it("does not let staff accounts sign in or act through the storefront", async () => {
    const admin = await createUser("admin");
    const login = await call(routes.login.POST, { method: "POST", body: { email: admin.email, password: PASSWORD } });
    expect(login.status).toBe(401);
    expect(cookieJar.size).toBe(0);

    // A storefront token stops working the moment its account becomes staff.
    const promoted = await createUser();
    const { signAccessToken } = await import("@/lib/auth/session");
    const token = await signAccessToken(promoted);
    await models.User.updateOne({ _id: promoted._id }, { $set: { role: "admin", adminRole: "owner" } });
    expect((await call(routes.customers.GET, { token })).status).toBe(401);

    const shopper = await createUser();
    expect((await call(routes.customers.GET, { as: shopper })).status).toBe(403);
    expect((await call(routes.customers.GET, { as: admin })).status).toBe(200);
  });

  it("limits failed sign-ins per account without counting successful ones", async () => {
    const [customer, other] = await Promise.all([createUser(), createUser()]);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await call(routes.login.POST, { method: "POST", body: { email: customer.email, password: PASSWORD } })).status).toBe(200);
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await call(routes.login.POST, { method: "POST", body: { email: customer.email, password: "wrong-password-1" } })).status).toBe(401);
    }
    const locked = await call(routes.login.POST, { method: "POST", body: { email: customer.email, password: PASSWORD } });
    expect(locked.status).toBe(429);
    expect((await call(routes.login.POST, { method: "POST", body: { email: other.email, password: PASSWORD } })).status).toBe(200);
  });

  it("resets a forgotten password through a single-use emailed link and signs out other sessions", async () => {
    const customer = await createUser();
    const { signAccessToken } = await import("@/lib/auth/session");
    const oldSession = await signAccessToken(customer);

    const unknown = await call(routes.forgotPassword.POST, { method: "POST", body: { email: "nobody@norosilk.test" } });
    // The link leads back to the domain (and, in development, the port) the request came in on.
    const known = await call(routes.forgotPassword.POST, { method: "POST", headers: { host: "localhost:3100" }, body: { email: customer.email } });
    expect([unknown.status, known.status]).toEqual([200, 200]);
    expect(unknown.json.message).toBe(known.json.message);
    expect(emails.map((email) => email.to)).toEqual([customer.email]);
    expect(emails[0].resetUrl).toMatch(/^http:\/\/localhost:3100\/account\/reset-password\?token=[\w-]{43}$/);

    const token = new URL(emails[0].resetUrl).searchParams.get("token");
    const weak = await call(routes.resetPassword.POST, { method: "POST", body: { token, newPassword: "short", confirmPassword: "short" } });
    expect(weak.status).toBe(422);
    const reset = await call(routes.resetPassword.POST, { method: "POST", body: { token, newPassword: "NewSilk-2027", confirmPassword: "NewSilk-2027" } });
    expect(reset.status).toBe(200);
    const reused = await call(routes.resetPassword.POST, { method: "POST", body: { token, newPassword: "Other-Silk-2028", confirmPassword: "Other-Silk-2028" } });
    expect(reused.status).toBe(400);

    expect((await call(routes.profile.GET, { token: oldSession })).status).toBe(401);
    expect((await call(routes.login.POST, { method: "POST", body: { email: customer.email, password: PASSWORD } })).status).toBe(401);
    expect((await call(routes.login.POST, { method: "POST", body: { email: customer.email, password: "NewSilk-2027" } })).status).toBe(200);
  });
});

describe("admin product edits", () => {
  it("keeps sales made while the editor was open and refuses to overwrite changed stock", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct(10)]);
    const loaded = (await call(routes.product.GET, { as: admin, params: { productId: String(product._id) } })).json.data;
    await paidCheckout(customer, product, 2);

    const edit = (changes) =>
      call(routes.product.PATCH, {
        as: admin,
        method: "PATCH",
        params: { productId: String(product._id) },
        body: { name: loaded.name, stockQuantity: loaded.stockQuantity, stockBaseline: loaded.stockQuantity, ...changes },
      });

    expect((await edit({ name: `${loaded.name} (new photos)` })).status).toBe(200);
    expect(await stockOf(product)).toBe(8);

    const conflict = await edit({ stockQuantity: 15 });
    expect(conflict.status).toBe(409);
    expect(conflict.json.errors).toEqual([expect.objectContaining({ field: "stockQuantity", message: expect.stringContaining("8") })]);
    expect(await stockOf(product)).toBe(8);

    expect((await edit({ stockQuantity: 15, stockBaseline: 8 })).status).toBe(200);
    expect(await stockOf(product)).toBe(15);
    const adjustments = await models.StockMovement.find({ product: product._id, reason: "admin_set" }).lean();
    expect(adjustments.map((entry) => entry.delta)).toEqual([7]);
  });
});

describe("revenue and invoices", () => {
  it("counts only paid, uncancelled orders in a customer's revenue", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct(10)]);
    const paid = await paidCheckout(customer, product, 1);
    await startCheckout(customer, product, 2); // unpaid

    const detail = await call(routes.customer.GET, { as: admin, path: "/api/v1/customers/x?detail=1", params: { customerId: String(customer._id) } });
    const total = (await orderOf(paid.internalOrderId)).totalAmount;
    expect(detail.json.data.overview).toMatchObject({ totalOrders: 2, paidOrders: 1, totalRevenue: total, averageOrderValue: total });

    // The dashboard applies the same rule across the store: paid or partly refunded, not cancelled, net of refunds.
    const { getAdminDashboardStats } = await import("@/lib/services/dashboard.service");
    const stats = await getAdminDashboardStats();
    const sales = (await models.Order.find({}).lean()).filter(
      (order) => ["paid", "partially_refunded"].includes(order.paymentStatus) && order.orderStatus !== "cancelled",
    );
    expect(stats.paidOrders).toBe(sales.length);
    expect(stats.paidRevenue).toBe(sales.reduce((sum, order) => sum + order.totalAmount - (order.amountRefunded ?? 0), 0));
  });

  it("numbers invoices in sequence when payment is confirmed and issues none for unpaid orders", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct(10)]);
    const first = await paidCheckout(customer, product, 1);
    const second = await paidCheckout(customer, product, 2);
    const serial = async (id) => Number((await orderOf(id)).invoice.number.split("/").at(-1));
    expect(await serial(second.internalOrderId)).toBe((await serial(first.internalOrderId)) + 1);

    const unpaid = await startCheckout(customer, product, 3);
    const download = await call(routes.invoice.GET, { as: customer, params: { orderId: unpaid.internalOrderId } });
    expect(download.status).toBe(409);
    expect((await orderOf(unpaid.internalOrderId)).invoice?.number).toBeUndefined();
  });
});

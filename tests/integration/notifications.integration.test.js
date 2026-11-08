/**
 * End-to-end tests for the notification system. Real route handlers and services
 * run against an isolated in-memory MongoDB replica set (checkout uses
 * transactions). Only external integrations are mocked: Razorpay and Delhivery.
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createTestTenant, enterTenantBeforeEach } from "../helpers/tenant.js";
import { signInto } from "../helpers/auth.js";

let testTenantId;
enterTenantBeforeEach(() => testTenantId);

const KEY_SECRET = "rzp_test_secret_for_notifications";
const WEBHOOK_SECRET = "rzp_webhook_secret_for_notifications";

const cookieJar = new Map();
const razorpay = { payments: new Map(), orderSeq: 0, refundSeq: 0 };
const tracking = { status: "In Transit" };
/** Work scheduled with `after()`; awaited at the end of each simulated request. */
const afterTasks = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name, value) => cookieJar.set(name, value),
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
      create: async ({ amount, currency }) => ({ id: `order_T${++razorpay.orderSeq}`, amount, currency }),
      fetchPayments: async (orderId) => ({ items: [...razorpay.payments.values()].filter((payment) => payment.order_id === orderId) }),
    },
    payments: {
      fetch: async (id) => {
        const payment = razorpay.payments.get(id);
        if (!payment) throw new Error("payment not found");
        return payment;
      },
      refund: async (_id, { amount }) => ({ id: `rfnd_T${++razorpay.refundSeq}`, amount }),
    },
  }),
}));
vi.mock("@/lib/delhivery/tracking", () => ({
  DELHIVERY_TRACKING_CACHE_MS: 0,
  fetchDelhiveryTracking: async (awb) => ({ awb, carrier: "Delhivery", status: tracking.status, events: [], cached: false }),
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
let service;
let events;
let jobs;
let adminRecipients;
let category;
let seq = 0;

async function createUser(role = "customer", extra = {}) {
  seq += 1;
  return models.User.create({
    name: `${role} ${seq}`,
    email: `notify-${role}-${seq}-${Date.now()}@norosilk.test`,
    password: "x".repeat(60),
    role,
    ...(role === "admin" ? { adminRole: "owner" } : {}),
    ...extra,
  });
}

async function createProduct(overrides = {}) {
  seq += 1;
  return models.Product.create({
    name: `Kanjivaram ${seq}`,
    slug: `kanjivaram-${seq}-${Date.now()}`,
    sku: `NS-${seq}-${Date.now()}`,
    category: category._id,
    price: 1000,
    wholesalePrice: 800,
    minimumOrderQuantity: 1,
    stockQuantity: 100,
    status: "active",
    ...overrides,
  });
}

async function call(handler, { as, method = "GET", path = "/api/v1/test", body, rawBody, headers = {}, params = {} } = {}) {
  cookieJar.clear();
  if (as) await signInto(cookieJar, as);
  const init = { method, headers: { "content-type": "application/json", ...headers } };
  if (rawBody !== undefined) init.body = rawBody;
  else if (body !== undefined) init.body = JSON.stringify(body);
  const response = await handler(new Request(`http://localhost${path}`, init), { params: Promise.resolve(params) });
  const json = await response.json();
  while (afterTasks.length) await Promise.all(afterTasks.splice(0));
  await service.flushNotifications();
  return { status: response.status, json };
}

function notificationsFor(user, filter = {}) {
  return models.Notification.find({ recipientId: user._id, ...filter }).lean();
}

async function checkout(customer, product, quantity = 1) {
  const result = await call(routes.createOrder.POST, {
    as: customer,
    method: "POST",
    body: { items: [{ productId: String(product._id), quantity }], shippingAddress: ADDRESS },
  });
  expect(result.status).toBe(201);
  return result.json.data;
}

function captureAtRazorpay(order, paymentId, overrides = {}) {
  razorpay.payments.set(paymentId, {
    id: paymentId,
    order_id: order.razorpayOrderId,
    amount: order.amount,
    currency: "INR",
    status: "captured",
    method: "upi",
    ...overrides,
  });
}

function verify(customer, order, paymentId, signature) {
  return call(routes.verify.POST, {
    as: customer,
    method: "POST",
    body: {
      razorpay_order_id: order.razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature:
        signature ?? createHmac("sha256", KEY_SECRET).update(`${order.razorpayOrderId}|${paymentId}`).digest("hex"),
    },
  });
}

function webhook(eventId, payload) {
  const rawBody = JSON.stringify({ id: eventId, ...payload });
  return call(routes.webhook.POST, {
    method: "POST",
    rawBody,
    headers: {
      "x-razorpay-event-id": eventId,
      "x-razorpay-signature": createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex"),
    },
  });
}

async function paidOrder(customer, product) {
  const order = await checkout(customer, product);
  const paymentId = `pay_${order.razorpayOrderId}`;
  captureAtRazorpay(order, paymentId);
  expect((await verify(customer, order, paymentId)).status).toBe(200);
  return { ...order, paymentId };
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("norosilk_notifications_test");

  await (await import("@/lib/db/connect")).connectDB();
  const { encryptSecret } = await import("@/lib/tenant/secrets");
  ({ tenantId: testTenantId } = await createTestTenant({
    integrations: {
      razorpay: { keyId: "rzp_test_key", keySecret: encryptSecret(KEY_SECRET), webhookSecret: encryptSecret(WEBHOOK_SECRET) },
    },
  }));

  models = {
    User: (await import("@/lib/db/models/User")).User,
    Product: (await import("@/lib/db/models/Product")).Product,
    Category: (await import("@/lib/db/models/Category")).Category,
    Order: (await import("@/lib/db/models/Order")).Order,
    Payment: (await import("@/lib/db/models/Payment")).Payment,
    Notification: (await import("@/lib/db/models/Notification")).Notification,
    StockAlert: (await import("@/lib/db/models/StockAlert")).StockAlert,
    SupportConversation: (await import("@/lib/db/models/SupportConversation")).SupportConversation,
    PaymentWebhookEvent: (await import("@/lib/db/models/PaymentWebhookEvent")).PaymentWebhookEvent,
  };
  // Unique partial indexes back the idempotency guarantees under test.
  await Promise.all(Object.values(models).map((model) => model.init()));
  for (const name of ["orders", "payments", "products"]) {
    await mongoose.connection.db.createCollection(name).catch(() => undefined);
  }

  service = await import("@/lib/services/notification.service");
  events = await import("@/lib/notifications/events");
  jobs = await import("@/lib/jobs/support-alerts.job");
  adminRecipients = await import("@/lib/notifications/admin-recipients");
  category = await models.Category.create({ name: "Silk sarees", slug: `silk-${Date.now()}` });

  routes = {
    createOrder: await import("@/app/api/v1/payments/create-order/route"),
    verify: await import("@/app/api/v1/payments/verify/route"),
    webhook: await import("@/app/api/v1/payments/webhook/route"),
    orderStatus: await import("@/app/api/v1/orders/[orderId]/status/route"),
    tracking: await import("@/app/api/v1/orders/[orderId]/tracking/route"),
    product: await import("@/app/api/v1/products/[productId]/route"),
    stockAlert: await import("@/app/api/v1/products/[productId]/stock-alert/route"),
    conversations: await import("@/app/api/v1/support/conversations/route"),
    messages: await import("@/app/api/v1/support/conversations/[conversationId]/messages/route"),
    adminMessages: await import("@/app/api/v1/admin/support/conversations/[conversationId]/messages/route"),
    list: await import("@/app/api/v1/notifications/route"),
    unread: await import("@/app/api/v1/notifications/unread-count/route"),
    read: await import("@/app/api/v1/notifications/[notificationId]/read/route"),
    readAll: await import("@/app/api/v1/notifications/read-all/route"),
    adminList: await import("@/app/api/v1/admin/notifications/route"),
    adminUnread: await import("@/app/api/v1/admin/notifications/unread-count/route"),
    adminRead: await import("@/app/api/v1/admin/notifications/[notificationId]/read/route"),
    adminReadAll: await import("@/app/api/v1/admin/notifications/read-all/route"),
  };
}, 180_000);

beforeEach(() => {
  adminRecipients.resetAdminRecipientCache();
  delete process.env.ADMIN_EMAIL;
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

describe("payments and orders", () => {
  it("notifies the customer and admins only after payment is verified, exactly once", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct()]);
    const order = await checkout(customer, product);

    // A pending (unpaid) order produces nothing yet.
    expect(await notificationsFor(customer)).toHaveLength(0);

    const paymentId = `pay_${order.razorpayOrderId}`;
    captureAtRazorpay(order, paymentId);
    expect((await verify(customer, order, paymentId)).status).toBe(200);

    const [customerRows, adminRows] = await Promise.all([notificationsFor(customer), notificationsFor(admin)]);
    expect(customerRows.map((row) => row.type)).toEqual(["payment_succeeded"]);
    expect(customerRows[0]).toMatchObject({ recipientType: "customer", isRead: false, url: `/account/orders/${order.internalOrderId}` });
    expect(adminRows.map((row) => row.type)).toEqual(["new_order"]);
    expect(adminRows[0]).toMatchObject({ audience: "commerce", url: `/admin/orders/${order.internalOrderId}` });

    // Retried verification and the capture webhook (incl. its own retry) are idempotent.
    await verify(customer, order, paymentId);
    const captured = { event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: order.razorpayOrderId } } } };
    await webhook("evt_capture_1", captured);
    await webhook("evt_capture_1", captured);
    await webhook("evt_capture_2", captured);

    expect(await notificationsFor(customer)).toHaveLength(1);
    expect(await notificationsFor(admin)).toHaveLength(1);
  });

  it("never sends a payment-success notification when verification fails", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct()]);
    const order = await checkout(customer, product);
    const paymentId = `pay_${order.razorpayOrderId}`;
    captureAtRazorpay(order, paymentId);

    expect((await verify(customer, order, paymentId, "f".repeat(64))).status).toBe(400);
    captureAtRazorpay(order, paymentId, { status: "authorized" });
    expect((await verify(customer, order, paymentId)).status).toBe(409);

    expect(await notificationsFor(customer, { type: "payment_succeeded" })).toHaveLength(0);
  });

  it("keeps the order payable after a failed attempt, then notifies once when the payment window expires", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct()]);
    const order = await checkout(customer, product);
    const failed = {
      event: "payment.failed",
      payload: { payment: { entity: { id: `pay_fail_${order.razorpayOrderId}`, order_id: order.razorpayOrderId, error_description: "Card declined" } } },
    };
    await webhook(`evt_fail_${order.razorpayOrderId}`, failed);
    await webhook(`evt_fail_${order.razorpayOrderId}`, failed);
    await webhook(`evt_fail2_${order.razorpayOrderId}`, failed);

    // Razorpay lets the shopper retry on the same order: nothing is cancelled or announced yet.
    expect(await notificationsFor(customer)).toHaveLength(0);
    expect(await models.Order.findById(order.internalOrderId).lean()).toMatchObject({ orderStatus: "pending_payment", inventoryReserved: true });

    await models.Order.updateOne({ _id: order.internalOrderId }, { $set: { paymentExpiresAt: new Date(Date.now() - 1000) } });
    const { runPaymentExpiryJob } = await import("@/lib/jobs/payment-expiry.job");
    await runPaymentExpiryJob({ triggeredBy: "test" });
    await runPaymentExpiryJob({ triggeredBy: "test" });
    while (afterTasks.length) await Promise.all(afterTasks.splice(0));
    await service.flushNotifications();

    const rows = await notificationsFor(customer);
    expect(rows.map((row) => row.type)).toEqual(["payment_failed"]);
    expect(rows[0]).toMatchObject({ severity: "warning", title: "Payment window expired" });
    expect(await models.Order.findById(order.internalOrderId).lean()).toMatchObject({ orderStatus: "cancelled", inventoryReserved: false });
  });

  it("raises a finance alert when the captured amount does not match", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct()]);
    const order = await checkout(customer, product);
    const paymentId = `pay_${order.razorpayOrderId}`;
    captureAtRazorpay(order, paymentId, { amount: order.amount - 100 });

    expect((await verify(customer, order, paymentId)).status).toBe(400);
    const alerts = await notificationsFor(admin, { type: "payment_issue" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ audience: "finance", severity: "critical" });
    expect(await notificationsFor(customer, { type: "payment_succeeded" })).toHaveLength(0);
  });

  it("does not fail or roll back payment verification when notifications cannot be written", async () => {
    const [customer, product] = await Promise.all([createUser(), createProduct()]);
    const order = await checkout(customer, product);
    const paymentId = `pay_${order.razorpayOrderId}`;
    captureAtRazorpay(order, paymentId);

    const bulkWrite = vi.spyOn(models.Notification, "bulkWrite").mockRejectedValue(new Error("notification store down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const result = await verify(customer, order, paymentId);
      expect(result.status).toBe(200);
      expect(consoleError.mock.calls.some(([line]) => String(line).includes("Notification delivery failed"))).toBe(true);
    } finally {
      bulkWrite.mockRestore();
      consoleError.mockRestore();
    }

    const stored = await models.Order.findById(order.internalOrderId).lean();
    expect(stored).toMatchObject({ paymentStatus: "paid", orderStatus: "confirmed" });
    expect(await notificationsFor(customer)).toHaveLength(0);
  });

  it("sends shipment updates once per milestone, whether reported by an admin or the carrier", async () => {
    const [customer, admin, product] = await Promise.all([createUser(), createUser("admin"), createProduct()]);
    const order = await paidOrder(customer, product);
    const params = { orderId: order.internalOrderId };
    const patch = (body) => call(routes.orderStatus.PATCH, { as: admin, method: "PATCH", params, body });

    expect((await patch({ orderStatus: "processing" })).status).toBe(200);
    expect((await patch({ orderStatus: "packed" })).status).toBe(200);
    expect((await patch({ shipmentAwb: "AWB123", customerVisibleRemark: "Dispatched via Delhivery." })).status).toBe(200);

    tracking.status = "Out for delivery";
    await call(routes.tracking.GET, { as: customer, params, path: `/api/v1/orders/${order.internalOrderId}/tracking?refresh=1` });
    tracking.status = "Delivered";
    await call(routes.tracking.GET, { as: customer, params, path: `/api/v1/orders/${order.internalOrderId}/tracking?refresh=1` });
    // The admin confirming the same milestones afterwards must not notify again.
    await patch({ orderStatus: "out_for_delivery" });
    await patch({ orderStatus: "delivered" });

    const statuses = (await notificationsFor(customer, { type: "order_status_changed" })).map((row) => row.metadata.status).sort();
    expect(statuses).toEqual(["delivered", "out_for_delivery", "packed", "processing", "shipped"]);
    const shipped = await models.Notification.findOne({ recipientId: customer._id, "metadata.status": "shipped" }).lean();
    expect(shipped.message).toContain("Dispatched via Delhivery.");
  });

  it("alerts admins about low stock after a reservation commits", async () => {
    const [customer, admin] = await Promise.all([createUser(), createUser("admin")]);
    const product = await createProduct({ stockQuantity: 7 });
    await checkout(customer, product, 3);

    const alerts = await notificationsFor(admin, { type: "low_stock" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ audience: "catalog", entityId: String(product._id) });
  });
});

describe("support", () => {
  it("notifies admins of new conversations and groups admin replies for the customer", async () => {
    const [customer, admin] = await Promise.all([createUser(), createUser("admin")]);
    const created = await call(routes.conversations.POST, {
      as: customer,
      method: "POST",
      body: { category: "order", subject: "Delivery date", message: "When will my order arrive?" },
    });
    const conversationId = created.json.data.id;
    expect(await notificationsFor(admin, { type: "support_new_conversation" })).toHaveLength(1);

    const reply = (body, clientMessageId) =>
      call(routes.adminMessages.POST, { as: admin, method: "POST", params: { conversationId }, body: { body, clientMessageId } });
    await reply("It ships tomorrow.", "msg-key-0001");
    await reply("It ships tomorrow.", "msg-key-0001"); // retried send
    await reply("Tracking will follow.", "msg-key-0002");

    let replies = await notificationsFor(customer, { type: "support_reply" });
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ groupCount: 2, isRead: false, url: `/account/support?c=${conversationId}` });

    await call(routes.read.PATCH, { as: customer, method: "PATCH", params: { notificationId: String(replies[0]._id) } });
    await reply("Delivered?", "msg-key-0003");
    replies = await notificationsFor(customer, { type: "support_reply" });
    expect(replies).toHaveLength(2);
    expect(replies.filter((row) => !row.isRead)).toHaveLength(1);

    // A customer follow-up notifies admins.
    await call(routes.messages.POST, { as: customer, method: "POST", params: { conversationId }, body: { body: "Thanks!" } });
    expect(await notificationsFor(admin, { type: "support_customer_message" })).toHaveLength(1);
  });

  it("alerts admins once about conversations left unanswered", async () => {
    const admin = await createUser("admin");
    const conversation = await models.SupportConversation.create({
      subject: "Waiting for help",
      status: "open",
      lastMessageRole: "customer",
      lastMessageAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
    });
    await jobs.runSupportUnansweredAlertsJob();
    await jobs.runSupportUnansweredAlertsJob();
    const alerts = await notificationsFor(admin, { type: "support_unanswered", entityId: String(conversation._id) });
    expect(alerts).toHaveLength(1);
  });
});

describe("back in stock", () => {
  it("notifies subscribed customers once, respecting their preference", async () => {
    const [subscriber, optedOut, admin] = await Promise.all([
      createUser(),
      createUser("customer", { notificationPreferences: { backInStock: false } }),
      createUser("admin"),
    ]);
    const product = await createProduct({ stockQuantity: 0, minimumOrderQuantity: 5 });
    const params = { productId: String(product._id) };

    expect((await call(routes.stockAlert.PUT, { method: "PUT", params })).status).toBe(401);
    for (const user of [subscriber, optedOut]) {
      expect((await call(routes.stockAlert.PUT, { as: user, method: "PUT", params })).status).toBe(200);
    }

    const restock = (stockQuantity) => call(routes.product.PATCH, { as: admin, method: "PATCH", params, body: { stockQuantity } });
    expect((await restock(3)).status).toBe(200); // still below the minimum order quantity
    expect(await notificationsFor(subscriber)).toHaveLength(0);

    await restock(40);
    await restock(60);
    expect((await notificationsFor(subscriber)).map((row) => row.type)).toEqual(["back_in_stock"]);
    expect(await notificationsFor(optedOut)).toHaveLength(0);
    expect(await models.StockAlert.countDocuments({ product: product._id, notifiedAt: null })).toBe(0);
  });
});

describe("notification APIs", () => {
  async function seed(user, count) {
    for (let index = 0; index < count; index += 1) {
      await service.notifyCustomer(user._id, {
        type: "order_status_changed",
        title: `Update ${index}`,
        dedupeKey: `seed:${user._id}:${index}`,
        url: "/account/orders",
      });
    }
  }

  it("requires authentication and keeps customers out of admin inboxes", async () => {
    const customer = await createUser();
    const id = new mongoose.Types.ObjectId().toString();
    for (const handler of [routes.list.GET, routes.unread.GET]) {
      expect((await call(handler)).status).toBe(401);
    }
    expect((await call(routes.read.PATCH, { method: "PATCH", params: { notificationId: id } })).status).toBe(401);
    expect((await call(routes.readAll.PATCH, { method: "PATCH" })).status).toBe(401);
    for (const handler of [routes.adminList.GET, routes.adminUnread.GET]) {
      expect((await call(handler, { as: customer })).status).toBe(403);
    }
    expect((await call(routes.adminReadAll.PATCH, { as: customer, method: "PATCH" })).status).toBe(403);
  });

  it("paginates with a cursor and reports unread counts", async () => {
    const customer = await createUser();
    await seed(customer, 25);

    const first = await call(routes.list.GET, { as: customer, path: "/api/v1/notifications?limit=10" });
    expect(first.json.data).toHaveLength(10);
    expect(first.json.meta).toMatchObject({ hasMore: true, unreadCount: 25 });
    expect(first.json.data[0]).not.toHaveProperty("recipientId");
    expect(first.json.data[0]).not.toHaveProperty("dedupeKey");

    const seen = new Set(first.json.data.map((item) => item.id));
    let cursor = first.json.meta.nextCursor;
    while (cursor) {
      const page = await call(routes.list.GET, { as: customer, path: `/api/v1/notifications?limit=10&cursor=${cursor}` });
      for (const item of page.json.data) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = page.json.meta.nextCursor;
    }
    expect(seen.size).toBe(25);

    expect((await call(routes.list.GET, { as: customer, path: "/api/v1/notifications?limit=500" })).status).toBe(422);
    expect((await call(routes.list.GET, { as: customer, path: "/api/v1/notifications?cursor=%7B%24gt%3A1%7D" })).status).toBe(422);
  });

  it("marks one or all notifications as read", async () => {
    const customer = await createUser();
    await seed(customer, 3);
    const { json } = await call(routes.list.GET, { as: customer });
    const target = json.data[0].id;

    const read = await call(routes.read.PATCH, { as: customer, method: "PATCH", params: { notificationId: target } });
    expect(read.json.data).toEqual({ id: target, unreadCount: 2 });
    // Idempotent.
    expect((await call(routes.read.PATCH, { as: customer, method: "PATCH", params: { notificationId: target } })).json.data.unreadCount).toBe(2);

    const unreadOnly = await call(routes.list.GET, { as: customer, path: "/api/v1/notifications?unread=1" });
    expect(unreadOnly.json.data.map((item) => item.id)).not.toContain(target);

    const all = await call(routes.readAll.PATCH, { as: customer, method: "PATCH" });
    expect(all.json.data).toEqual({ updated: 2, unreadCount: 0 });
    expect((await call(routes.unread.GET, { as: customer })).json.data.unreadCount).toBe(0);
  });

  it("never exposes or modifies another customer's notifications", async () => {
    const [owner, intruder] = await Promise.all([createUser(), createUser()]);
    await seed(owner, 2);
    const target = (await models.Notification.findOne({ recipientId: owner._id }).lean())._id.toString();

    expect((await call(routes.read.PATCH, { as: intruder, method: "PATCH", params: { notificationId: target } })).status).toBe(404);
    expect((await call(routes.read.PATCH, { as: intruder, method: "PATCH", params: { notificationId: "not-an-id" } })).status).toBe(404);
    await call(routes.readAll.PATCH, { as: intruder, method: "PATCH" });
    expect((await call(routes.list.GET, { as: intruder })).json.data).toHaveLength(0);
    expect(await models.Notification.countDocuments({ recipientId: owner._id, isRead: false })).toBe(2);
  });

  it("keeps admin inboxes separate and targets audiences by staff role", async () => {
    const [adminA, adminB] = await Promise.all([createUser("admin"), createUser("admin")]);
    const staffMember = await createUser("admin", { adminRole: "staff" });
    await service.notifyAdmins("support", { type: "support_new_conversation", title: "New conversation", dedupeKey: `admin-test:${Date.now()}` });
    await service.notifyAdmins("finance", { type: "payment_issue", title: "Finance alert", dedupeKey: `admin-fin:${Date.now()}` });

    for (const recipientId of [adminA._id, adminB._id, staffMember._id]) {
      expect(await models.Notification.countDocuments({ recipientId, recipientType: "admin", audience: "support" })).toBeGreaterThan(0);
    }
    expect(await models.Notification.countDocuments({ recipientId: staffMember._id, audience: "finance" })).toBe(0);

    const target = (await models.Notification.findOne({ recipientId: adminA._id, type: "support_new_conversation" }).lean())._id.toString();
    expect((await call(routes.adminRead.PATCH, { as: adminB, method: "PATCH", params: { notificationId: target } })).status).toBe(404);
    expect((await call(routes.adminRead.PATCH, { as: adminA, method: "PATCH", params: { notificationId: target } })).status).toBe(200);
  });

  it("enforces admin audience restrictions on reads", async () => {
    const { findNotificationsPage, markNotificationRead, countUnreadNotifications } = await import("@/lib/repositories/notification.repository");
    const admin = await createUser("admin");
    await service.notifyAdmins("finance", { type: "payment_issue", title: "Finance only", dedupeKey: `aud:${admin._id}:f` });
    await service.notifyAdmins("support", { type: "support_new_conversation", title: "Support", dedupeKey: `aud:${admin._id}:s` });
    const recipient = { recipientType: "admin", recipientId: admin._id };

    const supportOnly = await findNotificationsPage(recipient, { limit: 50, audiences: ["support"] });
    expect(supportOnly.items.map((item) => item.title)).toEqual(["Support"]);
    expect(await countUnreadNotifications(recipient, ["support"])).toBe(1);

    const finance = await models.Notification.findOne({ recipientId: admin._id, audience: "finance" }).lean();
    expect(await markNotificationRead(recipient, String(finance._id), ["support"])).toBe(false);
    expect(await markNotificationRead(recipient, String(finance._id), null)).toBe(true);
  });
});

describe("carrier milestones", () => {
  it("maps carrier status text conservatively", () => {
    expect(events.carrierMilestone("Out for Delivery")).toBe("out_for_delivery");
    expect(events.carrierMilestone("Delivered")).toBe("delivered");
    expect(events.carrierMilestone("Undelivered - consignee unavailable")).toBeNull();
    expect(events.carrierMilestone("RTO Delivered")).toBeNull();
    expect(events.carrierMilestone("In Transit")).toBeNull();
  });
});

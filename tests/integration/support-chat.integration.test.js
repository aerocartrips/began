/**
 * End-to-end tests for the customer support chat API. Route handlers run
 * against an isolated in-memory MongoDB; cookies, the dashboard admin session
 * and outbound email are mocked.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createTestTenant, enterTenantBeforeEach } from "../helpers/tenant.js";

let testTenantId;
enterTenantBeforeEach(() => testTenantId);

const cookieJar = new Map();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name, value) => cookieJar.set(name, value),
  }),
}));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal()), ...(await import("../stubs/next-server.js")), after: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ getAdminSession: async () => null }));
vi.mock("@/lib/services/email.service", () => ({ notifyContactMessage: vi.fn(async () => ({ sent: false })) }));

let mongo;
let routes;
let models;
let signAccessToken;
let ACCESS_COOKIE;
let userCounter = 0;

async function createUser(role = "customer") {
  userCounter += 1;
  return models.User.create({
    name: `${role === "admin" ? "Admin" : "Buyer"} ${userCounter}`,
    email: `support-${role}-${userCounter}-${Date.now()}@norosilk.test`,
    password: "x".repeat(60),
    role,
    ...(role === "admin" ? { adminRole: "owner" } : {}),
  });
}

/**
 * @param {(request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>} handler
 * @param {{ as?: any; method?: string; path?: string; body?: unknown; rawBody?: string; params?: Record<string, string> }} options
 */
async function call(handler, { as, method = "GET", path = "/api/v1/support/conversations", body, rawBody, params = {} } = {}) {
  cookieJar.clear();
  if (as) cookieJar.set(ACCESS_COOKIE, await signAccessToken(as));
  const init = { method, headers: { "content-type": "application/json" } };
  if (rawBody !== undefined) init.body = rawBody;
  else if (body !== undefined) init.body = JSON.stringify(body);
  const response = await handler(new Request(`http://localhost${path}`, init), { params: Promise.resolve(params) });
  return { status: response.status, headers: response.headers, json: await response.json() };
}

async function startConversation(user, overrides = {}) {
  const result = await call(routes.conversations.POST, {
    as: user,
    method: "POST",
    body: { category: "order", subject: "Where is my order?", message: "Hello, I need an update please.", ...overrides },
  });
  return result;
}

function send(user, conversationId, body, extra = {}) {
  return call(routes.messages.POST, {
    as: user,
    method: "POST",
    params: { conversationId },
    body: { body, ...extra },
  });
}

function listMessages(user, conversationId, query = "") {
  return call(routes.messages.GET, { as: user, params: { conversationId }, path: `/api/v1/support/conversations/${conversationId}/messages${query}` });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("norosilk_support_test");

  const session = await import("@/lib/auth/session");
  signAccessToken = session.signAccessToken;
  ACCESS_COOKIE = session.ACCESS_COOKIE;

  const { connectDB } = await import("@/lib/db/connect");
  await connectDB();
  ({ tenantId: testTenantId } = await createTestTenant());

  models = {
    User: (await import("@/lib/db/models/User")).User,
    Order: (await import("@/lib/db/models/Order")).Order,
    SupportConversation: (await import("@/lib/db/models/SupportConversation")).SupportConversation,
    SupportMessage: (await import("@/lib/db/models/SupportMessage")).SupportMessage,
  };
  // Unique partial indexes back the idempotency guarantees under test.
  await Promise.all([models.SupportConversation.init(), models.SupportMessage.init()]);

  routes = {
    conversations: await import("@/app/api/v1/support/conversations/route"),
    conversation: await import("@/app/api/v1/support/conversations/[conversationId]/route"),
    messages: await import("@/app/api/v1/support/conversations/[conversationId]/messages/route"),
    read: await import("@/app/api/v1/support/conversations/[conversationId]/read/route"),
    adminList: await import("@/app/api/v1/admin/support/conversations/route"),
    adminConversation: await import("@/app/api/v1/admin/support/conversations/[conversationId]/route"),
    adminMessages: await import("@/app/api/v1/admin/support/conversations/[conversationId]/messages/route"),
    adminRead: await import("@/app/api/v1/admin/support/conversations/[conversationId]/read/route"),
  };
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("authentication", () => {
  it("rejects unauthenticated requests to every customer endpoint", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const results = await Promise.all([
      call(routes.conversations.GET),
      call(routes.conversations.POST, { method: "POST", body: { category: "other", subject: "Hi there", message: "Hello" } }),
      call(routes.conversation.GET, { params: { conversationId: id } }),
      call(routes.conversation.PATCH, { method: "PATCH", params: { conversationId: id }, body: { status: "closed" } }),
      call(routes.messages.GET, { params: { conversationId: id } }),
      call(routes.messages.POST, { method: "POST", params: { conversationId: id }, body: { body: "Hello" } }),
      call(routes.read.POST, { method: "POST", params: { conversationId: id } }),
    ]);
    for (const result of results) {
      expect(result.status).toBe(401);
      expect(result.json.success).toBe(false);
    }
  });

  it("blocks customers from admin support endpoints", async () => {
    const customer = await createUser();
    const { json } = await startConversation(customer);
    const id = json.data.id;
    const results = await Promise.all([
      call(routes.adminList.GET, { as: customer }),
      call(routes.adminConversation.GET, { as: customer, params: { conversationId: id } }),
      call(routes.adminConversation.PATCH, { as: customer, method: "PATCH", params: { conversationId: id }, body: { status: "resolved" } }),
      call(routes.adminMessages.POST, { as: customer, method: "POST", params: { conversationId: id }, body: { body: "Pretending to be staff" } }),
    ]);
    for (const result of results) expect(result.status).toBe(403);
    const stored = await models.SupportMessage.countDocuments({ conversation: id, senderRole: "admin" });
    expect(stored).toBe(0);
  });
});

describe("conversations", () => {
  it("creates a conversation owned by the session user, ignoring any customer id in the body", async () => {
    const customer = await createUser();
    const other = await createUser();
    const { status, json } = await startConversation(customer, { customer: String(other._id), customerId: String(other._id) });

    expect(status).toBe(201);
    expect(json.data).toMatchObject({ subject: "Where is my order?", category: "order", status: "open", canReply: true, unreadCount: 0 });

    const stored = await models.SupportConversation.findById(json.data.id).lean();
    expect(String(stored.customer)).toBe(String(customer._id));
    expect(stored.source).toBe("account");
    expect(stored.unreadByAdmin).toBe(1);
    expect(await models.SupportMessage.countDocuments({ conversation: stored._id })).toBe(1);

    const list = await call(routes.conversations.GET, { as: customer });
    expect(list.json.data.map((row) => row.id)).toContain(json.data.id);
    const otherList = await call(routes.conversations.GET, { as: other });
    expect(otherList.json.data.map((row) => row.id)).not.toContain(json.data.id);
  });

  it("validates input", async () => {
    const customer = await createUser();
    const result = await startConversation(customer, { category: "not-a-topic", subject: "x", message: "   " });
    expect(result.status).toBe(422);
    const fields = result.json.errors.map((issue) => issue.field);
    expect(fields).toEqual(expect.arrayContaining(["category", "subject", "message"]));
  });

  it("only links orders the customer owns", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const order = await models.Order.collection.insertOne({
      tenantId: new mongoose.Types.ObjectId(testTenantId),
      orderNumber: `NS-T-${Date.now()}`,
      customer: owner._id,
      createdAt: new Date(),
    });
    const denied = await startConversation(stranger, { orderId: String(order.insertedId) });
    expect(denied.status).toBe(422);
    expect(denied.json.errors[0].field).toBe("orderId");

    const allowed = await startConversation(owner, { orderId: String(order.insertedId) });
    expect(allowed.status).toBe(201);
    expect(allowed.json.data.order.id).toBe(String(order.insertedId));
  });

  it("does not create duplicates when the same request is retried", async () => {
    const customer = await createUser();
    const clientRequestId = "retry-conversation-0001";
    const [first, second] = await Promise.all([
      startConversation(customer, { clientRequestId }),
      startConversation(customer, { clientRequestId }),
    ]);
    const third = await startConversation(customer, { clientRequestId });
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(third.status).toBe(200);
    expect(new Set([first.json.data.id, second.json.data.id, third.json.data.id]).size).toBe(1);
    expect(await models.SupportConversation.countDocuments({ customer: customer._id })).toBe(1);
    expect(await models.SupportMessage.countDocuments({ conversation: first.json.data.id })).toBe(1);
  });

  it("rate limits conversation creation", async () => {
    const customer = await createUser();
    for (let index = 0; index < 5; index += 1) {
      expect((await startConversation(customer, { subject: `Question number ${index}` })).status).toBe(201);
    }
    const blocked = await startConversation(customer, { subject: "One too many" });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await models.SupportConversation.countDocuments({ customer: customer._id })).toBe(5);
  });
});

describe("ownership (IDOR)", () => {
  it("hides one customer's conversation from another on every read and write", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const { json } = await startConversation(alice);
    const conversationId = json.data.id;

    const attempts = await Promise.all([
      call(routes.conversation.GET, { as: bob, params: { conversationId } }),
      call(routes.conversation.PATCH, { as: bob, method: "PATCH", params: { conversationId }, body: { status: "closed" } }),
      listMessages(bob, conversationId),
      send(bob, conversationId, "Injected message"),
      call(routes.read.POST, { as: bob, method: "POST", params: { conversationId } }),
    ]);
    for (const attempt of attempts) {
      expect(attempt.status).toBe(404);
      expect(JSON.stringify(attempt.json)).not.toContain("Hello, I need an update");
    }
    expect(await models.SupportMessage.countDocuments({ conversation: conversationId })).toBe(1);
    const stored = await models.SupportConversation.findById(conversationId).lean();
    expect(stored.status).toBe("open");
  });

  it("returns 404 for malformed ids", async () => {
    const customer = await createUser();
    const result = await call(routes.conversation.GET, { as: customer, params: { conversationId: "not-an-id" } });
    expect(result.status).toBe(404);
  });
});

describe("messaging", () => {
  it("sends a message and updates conversation activity", async () => {
    const customer = await createUser();
    const { json } = await startConversation(customer);
    const result = await send(customer, json.data.id, "  Any update on dispatch?\r\n\r\nThanks  ");

    expect(result.status).toBe(201);
    expect(result.json.data).toMatchObject({ sender: "customer", body: "Any update on dispatch?\n\nThanks" });
    expect(result.json.meta.conversation.lastMessagePreview).toBe("Any update on dispatch? Thanks");

    const stored = await models.SupportConversation.findById(json.data.id).lean();
    expect(stored.unreadByAdmin).toBe(2);
    expect(stored.lastMessageRole).toBe("customer");
  });

  it("rejects empty and oversized messages", async () => {
    const customer = await createUser();
    const { json } = await startConversation(customer);
    const id = json.data.id;

    expect((await send(customer, id, "")).status).toBe(422);
    expect((await send(customer, id, "   \n\t  ")).status).toBe(422);
    expect((await call(routes.messages.POST, { as: customer, method: "POST", params: { conversationId: id }, body: {} })).status).toBe(422);
    expect((await call(routes.messages.POST, { as: customer, method: "POST", params: { conversationId: id }, body: { body: 42 } })).status).toBe(422);
    expect((await send(customer, id, "a".repeat(5001))).status).toBe(422);
    expect((await send(customer, id, "a".repeat(5000))).status).toBe(201);
    expect((await call(routes.messages.POST, { as: customer, method: "POST", params: { conversationId: id }, rawBody: "{not json" })).status).toBe(400);
    expect((await send(customer, id, "a".repeat(30_000))).status).toBe(413);
    expect(await models.SupportMessage.countDocuments({ conversation: id })).toBe(2);
  });

  it("deduplicates retried sends with the same clientMessageId", async () => {
    const customer = await createUser();
    const { json } = await startConversation(customer);
    const id = json.data.id;
    const clientMessageId = "msg-retry-000001";

    const results = await Promise.all([1, 2, 3].map(() => send(customer, id, "Sent once", { clientMessageId })));
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(new Set(results.map((result) => result.json.data.id)).size).toBe(1);
    expect(await models.SupportMessage.countDocuments({ conversation: id, clientMessageId })).toBe(1);
    const stored = await models.SupportConversation.findById(id).lean();
    expect(stored.unreadByAdmin).toBe(2);
  });

  it("rate limits message sending", async () => {
    const customer = await createUser();
    const { json } = await startConversation(customer);
    for (let index = 0; index < 30; index += 1) {
      expect((await send(customer, json.data.id, `Message ${index}`)).status).toBe(201);
    }
    const blocked = await send(customer, json.data.id, "Too fast");
    expect(blocked.status).toBe(429);
    expect(await models.SupportMessage.countDocuments({ conversation: json.data.id })).toBe(31);
  });
});

describe("admin integration and read state", () => {
  it("delivers admin replies to the customer and tracks unread counts on both sides", async () => {
    const customer = await createUser();
    const admin = await createUser("admin");
    const { json } = await startConversation(customer);
    const conversationId = json.data.id;

    const inbox = await call(routes.adminList.GET, { as: admin, path: "/api/v1/admin/support/conversations?view=awaiting" });
    const row = inbox.json.data.find((item) => item.conversationId === conversationId);
    expect(row).toMatchObject({ name: customer.name, email: customer.email, category: "order", unread: true, awaitingReply: true });

    const reply = await call(routes.adminMessages.POST, {
      as: admin,
      method: "POST",
      params: { conversationId },
      body: { body: "Your order ships tomorrow.", clientMessageId: "admin-reply-0001" },
    });
    expect(reply.status).toBe(201);
    const storedReply = await models.SupportMessage.findById(reply.json.data.id).lean();
    expect(String(storedReply.sender)).toBe(String(admin._id));

    const thread = await listMessages(customer, conversationId);
    expect(thread.json.data.map((message) => message.sender)).toEqual(["customer", "support"]);
    expect(thread.json.data[1].body).toBe("Your order ships tomorrow.");
    expect(thread.json.meta.conversation).toMatchObject({ unreadCount: 1, status: "pending" });

    const read = await call(routes.read.POST, { as: customer, method: "POST", params: { conversationId } });
    expect(read.json.data.unread).toBe(0);
    const afterRead = await call(routes.conversation.GET, { as: customer, params: { conversationId } });
    expect(afterRead.json.data.unreadCount).toBe(0);
    expect(await models.SupportMessage.countDocuments({ conversation: conversationId, readByCustomer: false })).toBe(0);

    const adminRead = await call(routes.adminRead.POST, { as: admin, method: "POST", params: { conversationId } });
    expect(adminRead.json.data.unread).toBe(0);
    const awaiting = await call(routes.adminList.GET, { as: admin, path: "/api/v1/admin/support/conversations?view=awaiting" });
    expect(awaiting.json.data.some((item) => item.conversationId === conversationId)).toBe(false);

    const customerReply = await send(customer, conversationId, "Great, thanks!");
    expect(customerReply.status).toBe(201);
    const adminThread = await call(routes.adminMessages.GET, { as: admin, params: { conversationId } });
    expect(adminThread.json.data.at(-1).body).toBe("Great, thanks!");
    expect(adminThread.json.meta.conversation).toMatchObject({ unreadCount: 1, awaitingReply: true });
  });

  it("never exposes internal notes, priority or assignee to the customer", async () => {
    const customer = await createUser();
    const admin = await createUser("admin");
    const { json } = await startConversation(customer);
    const conversationId = json.data.id;

    await call(routes.adminConversation.PATCH, {
      as: admin,
      method: "PATCH",
      params: { conversationId },
      body: { internalNotes: "VIP buyer, check credit limit", priority: "urgent" },
    });

    const responses = await Promise.all([
      call(routes.conversation.GET, { as: customer, params: { conversationId } }),
      listMessages(customer, conversationId),
      call(routes.conversations.GET, { as: customer }),
    ]);
    for (const response of responses) {
      const text = JSON.stringify(response.json);
      expect(text).not.toContain("VIP buyer");
      expect(text).not.toContain("internalNotes");
      expect(text).not.toContain("urgent");
      expect(text).not.toContain("assignedAdmin");
    }
  });

  it("lets customers close but not resolve; closed threads are read-only and resolved ones reopen on reply", async () => {
    const customer = await createUser();
    const admin = await createUser("admin");

    const first = (await startConversation(customer)).json.data.id;
    for (const status of ["resolved", "open", "in_progress", "waiting_customer"]) {
      const denied = await call(routes.conversation.PATCH, { as: customer, method: "PATCH", params: { conversationId: first }, body: { status } });
      expect(denied.status).toBe(403);
    }
    const priority = await call(routes.conversation.PATCH, {
      as: customer,
      method: "PATCH",
      params: { conversationId: first },
      body: { status: "closed", internalNotes: "x" },
    });
    expect(priority.status).toBe(200);
    expect(priority.json.data).toMatchObject({ status: "closed", canReply: false });
    expect((await models.SupportConversation.findById(first).lean()).internalNotes).toBe("");
    expect((await send(customer, first, "Still there?")).status).toBe(409);

    const second = (await startConversation(customer, { subject: "Another question" })).json.data.id;
    await call(routes.adminConversation.PATCH, { as: admin, method: "PATCH", params: { conversationId: second }, body: { status: "resolved" } });
    const resolved = await call(routes.conversation.GET, { as: customer, params: { conversationId: second } });
    expect(resolved.json.data).toMatchObject({ status: "resolved", canReply: true });

    const reopened = await send(customer, second, "Actually one more thing");
    expect(reopened.status).toBe(201);
    expect(reopened.json.meta.conversation.status).toBe("open");
    const stored = await models.SupportConversation.findById(second).lean();
    expect(stored.resolvedAt).toBeNull();
  });
});

describe("pagination", () => {
  it("returns the latest messages first and pages backwards and forwards without gaps", async () => {
    const customer = await createUser();
    const { json } = await startConversation(customer, { message: "Message 0" });
    const conversationId = json.data.id;

    const base = Date.now();
    await models.SupportMessage.insertMany(
      Array.from({ length: 44 }, (_, index) => ({
        conversation: conversationId,
        senderRole: index % 2 ? "admin" : "customer",
        body: `Message ${index + 1}`,
        // Pairs share a timestamp to exercise the (createdAt, _id) tie-break.
        createdAt: new Date(base + 1000 + Math.floor(index / 2) * 1000),
      })),
    );

    const latest = await listMessages(customer, conversationId, "?limit=20");
    expect(latest.json.data).toHaveLength(20);
    expect(latest.json.meta.hasMore).toBe(true);
    expect(latest.json.data.at(-1).body).toBe("Message 44");
    expect(latest.json.data[0].body).toBe("Message 25");

    const older = await listMessages(customer, conversationId, `?limit=20&before=${encodeURIComponent(latest.json.data[0].cursor)}`);
    expect(older.json.data.map((message) => message.body)).toEqual(Array.from({ length: 20 }, (_, index) => `Message ${index + 5}`));
    expect(older.json.meta.hasMore).toBe(true);

    const oldest = await listMessages(customer, conversationId, `?limit=20&before=${encodeURIComponent(older.json.data[0].cursor)}`);
    expect(oldest.json.data.map((message) => message.body)).toEqual(["Message 0", "Message 1", "Message 2", "Message 3", "Message 4"]);
    expect(oldest.json.meta.hasMore).toBe(false);

    const newer = await listMessages(customer, conversationId, `?after=${encodeURIComponent(latest.json.data[17].cursor)}`);
    expect(newer.json.data.map((message) => message.body)).toEqual(["Message 43", "Message 44"]);

    await models.SupportMessage.insertMany(
      Array.from({ length: 10 }, (_, index) => ({
        conversation: conversationId,
        senderRole: "customer",
        body: `Extra ${index}`,
        createdAt: new Date(base + 100_000 + index),
      })),
    );
    const capped = await listMessages(customer, conversationId, "?limit=500");
    expect(capped.json.data).toHaveLength(50);
    expect(capped.json.meta.hasMore).toBe(true);

    expect((await listMessages(customer, conversationId, "?before=garbage")).status).toBe(400);
  });

  it("paginates the conversation list", async () => {
    const customer = await createUser();
    const ids = [];
    for (let index = 0; index < 3; index += 1) {
      ids.push((await startConversation(customer, { subject: `Paged question ${index}` })).json.data.id);
    }
    const page1 = await call(routes.conversations.GET, { as: customer, path: "/api/v1/support/conversations?limit=2&page=1" });
    const page2 = await call(routes.conversations.GET, { as: customer, path: "/api/v1/support/conversations?limit=2&page=2" });
    expect(page1.json.data).toHaveLength(2);
    expect(page1.json.meta).toMatchObject({ total: 3, totalPages: 2 });
    expect(page2.json.data).toHaveLength(1);
    const seen = [...page1.json.data, ...page2.json.data].map((row) => row.id);
    expect(new Set(seen)).toEqual(new Set(ids));
  });
});

describe("contact form compatibility", () => {
  it("still stores guest contact messages in the same support inbox", async () => {
    const { submitContactMessage } = await import("@/lib/services/support-messages.service");
    const { messageId } = await submitContactMessage({
      name: "Guest Buyer",
      email: "guest@norosilk.test",
      phone: "",
      subject: "Wholesale enquiry",
      message: "Please share your price list for silk sarees.",
    });
    const admin = await createUser("admin");
    const detail = await call(routes.adminConversation.GET, { as: admin, params: { conversationId: messageId } });
    expect(detail.status).toBe(200);
    expect(detail.json.data.conversation).toMatchObject({ name: "Guest Buyer", source: "contact", customerId: null });
    expect(detail.json.data.messages[0].body).toContain("price list");
  });
});

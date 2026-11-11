/**
 * End-to-end tests for the customer account API (profile, address book,
 * security, preferences, privacy) and its checkout integration. Route handlers
 * run against an isolated in-memory MongoDB; cookies, the dashboard admin
 * session and outbound email are mocked.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createTestTenant, enterTenantBeforeEach } from "../helpers/tenant.js";
import { signInto } from "../helpers/auth.js";

let testTenantId;
enterTenantBeforeEach(() => testTenantId);

const cookieJar = new Map();
const sentEmails = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name) => (cookieJar.get(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name, value) => cookieJar.set(name, value),
  }),
}));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal()), ...(await import("../stubs/next-server.js")), after: vi.fn() }));
vi.mock("@/lib/services/email.service", () => ({
  isCustomerEmailConfigured: () => true,
  notifyContactMessage: vi.fn(async () => ({ sent: false })),
  notifyNewOrder: vi.fn(async () => ({ sent: false })),
  sendEmailVerificationCode: vi.fn(async (message) => {
    sentEmails.push(message);
    return { sent: true };
  }),
  sendEmailChangedNotice: vi.fn(async (message) => {
    sentEmails.push(message);
    return { sent: true };
  }),
}));

const PASSWORD = "Silk-route-2024";

let mongo;
let routes;
let models;
let session;
let buildOrderDraft;
let counter = 0;

const ADDRESS = {
  label: "office",
  fullName: "Asha Rao",
  phone: "+91 98765 43210",
  addressLine1: "12 Weavers Lane",
  addressLine2: "Second floor",
  landmark: "Near clock tower",
  city: "Kanchipuram",
  state: "tamil nadu",
  pincode: "631501",
  country: "India",
};

async function createUser(role = "customer", overrides = {}) {
  counter += 1;
  return models.User.create({
    name: `Buyer ${counter}`,
    email: `account-${role}-${counter}@norosilk.test`,
    password: await bcrypt.hash(PASSWORD, 4),
    role,
    // Email delivery is "configured" in this suite, so storefront sessions need a verified address.
    isEmailVerified: true,
    ...(role === "admin" ? { adminRole: "owner" } : {}),
    ...overrides,
  });
}

/**
 * @param {(request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>} handler
 * @param {{ as?: any; token?: string; keep?: boolean; method?: string; path?: string; headers?: Record<string, string>; body?: unknown; params?: Record<string, string> }} [options]
 *   `keep`: send the cookies the previous call left (a browser in the middle of signing in).
 */
async function call(handler, { as, token, keep = false, method = "GET", path = "/api/v1/account", headers = {}, body, params = {} } = {}) {
  if (!keep) cookieJar.clear();
  if (token) cookieJar.set(session.ACCESS_COOKIE, token);
  else if (as) await signInto(cookieJar, as);
  const init = { method, headers: { "content-type": "application/json", ...headers } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await handler(new Request(`http://localhost${path}`, init), { params: Promise.resolve(params) });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, headers: response.headers, json };
}

const addAddress = (user, overrides = {}) =>
  call(routes.addresses.POST, { as: user, method: "POST", body: { ...ADDRESS, ...overrides } });

const fieldsOf = (result) => (result.json.errors ?? []).map((error) => error.field);

async function createProduct() {
  counter += 1;
  return models.Product.create({
    name: `Kanjivaram ${counter}`,
    slug: `kanjivaram-${counter}`,
    sku: `KJ-${counter}`,
    category: new mongoose.Types.ObjectId(),
    price: 4200,
    wholesalePrice: 3800,
    minimumOrderQuantity: 1,
    stockQuantity: 50,
    status: "active",
  });
}

function orderFixture(customer, overrides = {}) {
  counter += 1;
  const address = { fullName: "Asha Rao", phone: "9876543210", addressLine1: "12 Lane", city: "Chennai", state: "Tamil Nadu", pincode: "600001" };
  return models.Order.create({
    orderNumber: `NS-T${counter}`,
    customer: customer._id,
    items: [{ product: new mongoose.Types.ObjectId(), productName: "Saree", sku: "SKU-1", quantity: 2, unitPrice: 100, lineTotal: 200 }],
    shippingAddress: address,
    billingAddress: address,
    subtotal: 200,
    totalAmount: 200,
    internalNotes: "staff only",
    ...overrides,
  });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("norosilk_account_test");

  session = await import("@/lib/auth/session");
  const { connectDB } = await import("@/lib/db/connect");
  await connectDB();
  ({ tenantId: testTenantId } = await createTestTenant());

  models = {
    User: (await import("@/lib/db/models/User")).User,
    Order: (await import("@/lib/db/models/Order")).Order,
    Product: (await import("@/lib/db/models/Product")).Product,
  };
  await models.User.init();
  ({ buildOrderDraft } = await import("@/lib/services/order.service"));

  routes = {
    profile: await import("@/app/api/v1/account/profile/route"),
    addresses: await import("@/app/api/v1/account/addresses/route"),
    address: await import("@/app/api/v1/account/addresses/[addressId]/route"),
    addressDefault: await import("@/app/api/v1/account/addresses/[addressId]/default/route"),
    preferences: await import("@/app/api/v1/account/preferences/route"),
    password: await import("@/app/api/v1/account/password/route"),
    security: await import("@/app/api/v1/account/security/route"),
    email: await import("@/app/api/v1/account/email/route"),
    emailVerify: await import("@/app/api/v1/account/email/verify/route"),
    register: await import("@/app/api/v1/auth/register/route"),
    login: await import("@/app/api/v1/auth/login/route"),
    signInCode: await import("@/app/api/v1/auth/verify-email/route"),
    signInResend: await import("@/app/api/v1/auth/verify-email/resend/route"),
    exportData: await import("@/app/api/v1/account/export/route"),
    deletion: await import("@/app/api/v1/account/deletion-request/route"),
    logoutAll: await import("@/app/api/v1/auth/logout-all/route"),
    anonymize: await import("@/app/api/v1/customers/[customerId]/anonymize/route"),
  };
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("authentication", () => {
  it("rejects unauthenticated requests to every account endpoint", async () => {
    const params = { addressId: new mongoose.Types.ObjectId().toString() };
    const results = await Promise.all([
      call(routes.profile.GET),
      call(routes.profile.PATCH, { method: "PATCH", body: { firstName: "X" } }),
      call(routes.addresses.GET),
      call(routes.addresses.POST, { method: "POST", body: ADDRESS }),
      call(routes.address.PUT, { method: "PUT", params, body: ADDRESS }),
      call(routes.address.DELETE, { method: "DELETE", params }),
      call(routes.addressDefault.POST, { method: "POST", params, body: { type: "both" } }),
      call(routes.preferences.PATCH, { method: "PATCH", body: { promotional: true } }),
      call(routes.password.POST, { method: "POST", body: {} }),
      call(routes.security.GET),
      call(routes.email.POST, { method: "POST", body: { email: "a@b.co" } }),
      call(routes.exportData.GET),
      call(routes.deletion.POST, { method: "POST", body: {} }),
      call(routes.logoutAll.POST, { method: "POST" }),
    ]);
    for (const result of results) expect(result.status).toBe(401);
  });

  it("restricts anonymization to administrators", async () => {
    const customer = await createUser();
    const result = await call(routes.anonymize.POST, { as: customer, method: "POST", params: { customerId: String(customer._id) } });
    expect(result.status).toBe(403);
  });
});

describe("profile", () => {
  it("returns a client-safe profile split from the legacy name", async () => {
    const user = await createUser("customer", { name: "Meera Krishnan Iyer" });
    const result = await call(routes.profile.GET, { as: user });
    expect(result.status).toBe(200);
    expect(result.json.data.profile).toMatchObject({ firstName: "Meera", lastName: "Krishnan Iyer", email: user.email });
    const serialized = JSON.stringify(result.json);
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("sessionVersion");
  });

  it("updates whitelisted fields only and keeps the display name in sync", async () => {
    const user = await createUser();
    const result = await call(routes.profile.PATCH, {
      as: user,
      method: "PATCH",
      body: {
        firstName: "Lakshmi",
        lastName: "Narayan",
        phone: "098765 43210",
        companyName: "Narayan Silks",
        gstNumber: "33aabcn1234f1z5",
        role: "admin",
        email: "attacker@evil.test",
        isEmailVerified: false,
      },
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ name: "Lakshmi Narayan", phone: "9876543210", gstNumber: "33AABCN1234F1Z5" });

    const stored = await models.User.findById(user._id).lean();
    expect(stored).toMatchObject({ role: "customer", email: user.email, isEmailVerified: true, name: "Lakshmi Narayan" });
  });

  it("returns field-level validation errors", async () => {
    const user = await createUser();
    const result = await call(routes.profile.PATCH, {
      as: user,
      method: "PATCH",
      body: { phone: "12345", gstNumber: "NOT-A-GSTIN" },
    });
    expect(result.status).toBe(422);
    expect(fieldsOf(result)).toEqual(expect.arrayContaining(["phone", "gstNumber"]));
  });
});

describe("address book", () => {
  it("makes the first address the default for shipping and billing", async () => {
    const user = await createUser();
    const result = await addAddress(user);
    expect(result.status).toBe(201);
    const { address, book } = result.json.data;
    expect(address).toMatchObject({ phone: "9876543210", state: "Tamil Nadu", isDefaultShipping: true, isDefaultBilling: true });
    expect(book.defaultShippingId).toBe(address.id);
    expect(book.defaultBillingId).toBe(address.id);
  });

  it("keeps separate shipping and billing defaults", async () => {
    const user = await createUser();
    const first = (await addAddress(user)).json.data.address;
    const second = (await addAddress(user, { label: "home", makeDefaultShipping: true })).json.data.address;
    expect(second.isDefaultShipping).toBe(true);
    expect(second.isDefaultBilling).toBe(false);

    const result = await call(routes.addressDefault.POST, {
      as: user,
      method: "POST",
      params: { addressId: first.id },
      body: { type: "shipping" },
    });
    expect(result.json.data).toMatchObject({ defaultShippingId: first.id, defaultBillingId: first.id });

    const billing = await call(routes.addressDefault.POST, {
      as: user,
      method: "POST",
      params: { addressId: second.id },
      body: { type: "billing" },
    });
    expect(billing.json.data).toMatchObject({ defaultShippingId: first.id, defaultBillingId: second.id });
  });

  it("rejects invalid PIN codes, phone numbers and states", async () => {
    const user = await createUser();
    const result = await addAddress(user, { pincode: "012345", phone: "12345678", state: "Atlantis" });
    expect(result.status).toBe(422);
    expect(fieldsOf(result)).toEqual(expect.arrayContaining(["pincode", "phone", "state"]));
  });

  it("accepts international addresses with E.164 phone numbers", async () => {
    const user = await createUser();
    const result = await addAddress(user, { country: "United Kingdom", state: "Greater London", pincode: "sw1a 1aa", phone: "+44 20 7946 0958" });
    expect(result.status).toBe(201);
    expect(result.json.data.address).toMatchObject({ pincode: "SW1A 1AA", phone: "+442079460958" });
  });

  it("enforces the address limit even under concurrent writes", async () => {
    const user = await createUser();
    const results = await Promise.all(Array.from({ length: 13 }, () => addAddress(user)));
    expect(results.filter((result) => result.status === 201)).toHaveLength(10);
    expect(results.filter((result) => result.status === 409)).toHaveLength(3);
    const stored = await models.User.findById(user._id).lean();
    expect(stored.addresses).toHaveLength(10);
    expect(String(stored.defaultShippingAddressId)).toBe(String(stored.addresses[0]._id));
  });

  it("edits an address in place", async () => {
    const user = await createUser();
    const created = (await addAddress(user)).json.data.address;
    const result = await call(routes.address.PUT, {
      as: user,
      method: "PUT",
      params: { addressId: created.id },
      body: { ...ADDRESS, city: "Madurai", pincode: "625001" },
    });
    expect(result.status).toBe(200);
    expect(result.json.data.address).toMatchObject({ id: created.id, city: "Madurai", pincode: "625001", isDefaultShipping: true });
  });

  it("reassigns defaults when a default address is deleted, and clears them when none remain", async () => {
    const user = await createUser();
    const first = (await addAddress(user)).json.data.address;
    const second = (await addAddress(user, { label: "home" })).json.data.address;

    const afterFirst = await call(routes.address.DELETE, { as: user, method: "DELETE", params: { addressId: first.id } });
    expect(afterFirst.status).toBe(200);
    expect(afterFirst.json.data).toMatchObject({ defaultShippingId: second.id, defaultBillingId: second.id });

    const afterSecond = await call(routes.address.DELETE, { as: user, method: "DELETE", params: { addressId: second.id } });
    expect(afterSecond.json.data).toMatchObject({ items: [], defaultShippingId: null, defaultBillingId: null });
    const stored = await models.User.findById(user._id).lean();
    expect(stored.defaultShippingAddressId).toBeNull();
  });

  it("prevents customers from reading or changing another customer's addresses", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const address = (await addAddress(owner)).json.data.address;
    const params = { addressId: address.id };

    const results = await Promise.all([
      call(routes.address.PUT, { as: intruder, method: "PUT", params, body: { ...ADDRESS, city: "Hijacked" } }),
      call(routes.address.DELETE, { as: intruder, method: "DELETE", params }),
      call(routes.addressDefault.POST, { as: intruder, method: "POST", params, body: { type: "both" } }),
    ]);
    for (const result of results) expect(result.status).toBe(404);

    const intruderBook = await call(routes.addresses.GET, { as: intruder });
    expect(intruderBook.json.data.items).toHaveLength(0);
    const stored = await models.User.findById(owner._id).lean();
    expect(stored.addresses[0].city).toBe("Kanchipuram");
    const intruderStored = await models.User.findById(intruder._id).lean();
    expect(intruderStored.defaultShippingAddressId).toBeNull();
  });
});

describe("checkout integration", () => {
  it("snapshots a saved address and keeps historical orders unchanged after edits", async () => {
    const user = await createUser("customer", { companyName: "Rao Textiles", gstNumber: "33AABCR1234F1Z5" });
    const shipping = (await addAddress(user)).json.data.address;
    const billing = (await addAddress(user, { label: "home", city: "Chennai", pincode: "600001", gstin: "33AABCB9999F1Z5" })).json.data.address;
    const product = await createProduct();
    const customer = await models.User.findById(user._id);

    const draft = await buildOrderDraft(customer, {
      items: [{ productId: String(product._id), quantity: 2 }],
      shippingAddressId: shipping.id,
      billingAddressId: billing.id,
    });
    expect(draft.shippingAddress).toMatchObject({ fullName: "Asha Rao", city: "Kanchipuram", landmark: "Near clock tower", phone: "9876543210" });
    expect(draft.billingAddress).toMatchObject({ city: "Chennai", companyName: "Rao Textiles", gstin: "33AABCB9999F1Z5" });

    const order = await orderFixture(user, {
      items: draft.lineItems,
      shippingAddress: draft.shippingAddress,
      billingAddress: draft.billingAddress,
      subtotal: draft.totals.subtotal,
      totalAmount: draft.totals.totalAmount,
    });

    await call(routes.address.PUT, { as: user, method: "PUT", params: { addressId: shipping.id }, body: { ...ADDRESS, city: "Madurai", pincode: "625001" } });
    await call(routes.profile.PATCH, { as: user, method: "PATCH", body: { companyName: "Renamed Co", gstNumber: "" } });

    const stored = await models.Order.findById(order._id).lean();
    expect(stored.shippingAddress.city).toBe("Kanchipuram");
    expect(stored.billingAddress).toMatchObject({ companyName: "Rao Textiles", gstin: "33AABCB9999F1Z5" });
  });

  it("falls back to shipping for billing and accepts a raw checkout address", async () => {
    const user = await createUser();
    const product = await createProduct();
    const customer = await models.User.findById(user._id);
    const draft = await buildOrderDraft(customer, {
      items: [{ productId: String(product._id), quantity: 1 }],
      shippingAddress: { fullName: "Guest Buyer", phone: "9876500000", addressLine1: "1 Road", city: "Surat", state: "Gujarat", pincode: "395003" },
    });
    expect(draft.billingAddress).toMatchObject({ fullName: "Guest Buyer", city: "Surat", gstin: "" });
  });

  it("never resolves an address id owned by another customer", async () => {
    const owner = await createUser();
    const other = await createUser();
    const address = (await addAddress(owner)).json.data.address;
    const product = await createProduct();
    const customer = await models.User.findById(other._id);

    await expect(
      buildOrderDraft(customer, { items: [{ productId: String(product._id), quantity: 1 }], shippingAddressId: address.id }),
    ).rejects.toMatchObject({ statusCode: 422, errors: [{ field: "shippingAddressId" }] });
  });

  it("requires exactly one shipping address source", async () => {
    const user = await createUser();
    const customer = await models.User.findById(user._id);
    const items = [{ productId: new mongoose.Types.ObjectId().toString(), quantity: 1 }];
    await expect(buildOrderDraft(customer, { items })).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      buildOrderDraft(customer, { items, shippingAddressId: new mongoose.Types.ObjectId().toString(), shippingAddress: { ...ADDRESS, pincode: "631501" } }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe("security", () => {
  it("validates password changes", async () => {
    const user = await createUser();
    const wrong = await call(routes.password.POST, {
      as: user,
      method: "POST",
      body: { currentPassword: "not-it-123", newPassword: "Another-pass-1", confirmPassword: "Another-pass-1" },
    });
    expect(wrong.status).toBe(422);
    expect(fieldsOf(wrong)).toEqual(["currentPassword"]);

    const weak = await call(routes.password.POST, {
      as: user,
      method: "POST",
      body: { currentPassword: PASSWORD, newPassword: "onlyletters", confirmPassword: "different" },
    });
    expect(weak.status).toBe(422);
    expect(fieldsOf(weak)).toEqual(expect.arrayContaining(["newPassword", "confirmPassword"]));
  });

  it("changes the password, keeps this session and revokes the others", async () => {
    const user = await createUser();
    const oldToken = await session.signAccessToken(user);
    const result = await call(routes.password.POST, {
      token: oldToken,
      method: "POST",
      body: { currentPassword: PASSWORD, newPassword: "Fresh-weave-2025", confirmPassword: "Fresh-weave-2025" },
    });
    expect(result.status).toBe(200);
    const freshToken = cookieJar.get(session.ACCESS_COOKIE);
    expect(freshToken).toBeTruthy();

    expect((await call(routes.profile.GET, { token: oldToken })).status).toBe(401);
    expect((await call(routes.profile.GET, { token: freshToken })).status).toBe(200);

    const stored = await models.User.findById(user._id).select("+password +securityEvents").lean();
    expect(await bcrypt.compare("Fresh-weave-2025", stored.password)).toBe(true);
    expect(stored.password).not.toContain("Fresh-weave");
    expect(stored.securityEvents.map((event) => event.type)).toContain("password_changed");
  });

  it("rate-limits password change attempts", async () => {
    const user = await createUser();
    const attempt = () =>
      call(routes.password.POST, {
        as: user,
        method: "POST",
        body: { currentPassword: "wrong-pass-1", newPassword: "Another-pass-1", confirmPassword: "Another-pass-1" },
      });
    for (let index = 0; index < 5; index += 1) expect((await attempt()).status).toBe(422);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("signs out of every device", async () => {
    const user = await createUser();
    const token = await session.signAccessToken(user);
    expect((await call(routes.logoutAll.POST, { token, method: "POST" })).status).toBe(200);
    expect((await call(routes.profile.GET, { token })).status).toBe(401);
    const security = await call(routes.security.GET, { as: await models.User.findById(user._id) });
    expect(security.json.data.activity[0].type).toBe("sessions_revoked");
  });

  it("changes the email only after the code sent to the new address is entered", async () => {
    const user = await createUser();
    const taken = await createUser();
    const asUser = { as: user, method: "POST", headers: { "x-forwarded-for": "203.0.113.20" } };

    const duplicate = await call(routes.email.POST, { ...asUser, body: { email: taken.email, currentPassword: PASSWORD } });
    expect(duplicate.status).toBe(409);
    expect(fieldsOf(await call(routes.email.POST, { ...asUser, body: { email: user.email } }))).toEqual(["email"]);

    const noPassword = await call(routes.email.POST, { ...asUser, body: { email: "new-address@norosilk.test" } });
    expect(fieldsOf(noPassword)).toEqual(["currentPassword"]);

    const requested = await call(routes.email.POST, { ...asUser, body: { email: "New-Address@norosilk.test", currentPassword: PASSWORD } });
    expect(requested.status).toBe(200);
    expect(requested.json.data).toMatchObject({ email: "new-address@norosilk.test", pendingEmail: "new-address@norosilk.test" });
    expect((await models.User.findById(user._id).lean()).email).toBe(user.email);

    const message = sentEmails.at(-1);
    expect(message).toMatchObject({ to: "new-address@norosilk.test", isChange: true });
    expect(message.code).toMatch(/^\d{6}$/);

    // Asking again (the form's resend) needs no password while the code is valid, and sends nothing during the cooldown.
    const again = await call(routes.email.POST, { ...asUser, body: { email: "new-address@norosilk.test" } });
    expect(again.status).toBe(200);
    expect(sentEmails.at(-1)).toBe(message);

    const wrong = await call(routes.emailVerify.POST, { ...asUser, body: { code: otherCode(message.code) } });
    expect(wrong.status).toBe(422);
    expect(wrong.json.errors).toEqual([{ field: "code", message: "That code isn't right. 4 attempts left." }]);

    const verified = await call(routes.emailVerify.POST, { ...asUser, body: { code: message.code } });
    expect(verified.status).toBe(200);
    expect(verified.json.data).toEqual({ email: "new-address@norosilk.test", changed: true });
    const stored = await models.User.findById(user._id).lean();
    expect(stored).toMatchObject({ email: "new-address@norosilk.test", isEmailVerified: true });
    expect(sentEmails.at(-1)).toMatchObject({ to: user.email, newEmail: "new-address@norosilk.test" });

    const reused = await call(routes.emailVerify.POST, { ...asUser, body: { code: message.code } });
    expect(reused.json.errors).toEqual([{ field: "code", message: "This code has expired. Request a new one." }]);
  });
});

/** A valid-looking code that isn't `code`. */
const otherCode = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

describe("email verification before the first session", () => {
  const from = (n) => ({ "x-forwarded-for": `198.51.100.${n}` });
  const cookie = (name) => cookieJar.get(name) || undefined;

  it("opens a new account's session only once the emailed code is entered", async () => {
    const { EMAIL_VERIFICATION_COOKIE } = await import("@/lib/auth/cookies");
    counter += 1;
    const email = `new-buyer-${counter}@norosilk.test`;
    const registered = await call(routes.register.POST, {
      method: "POST",
      path: "/api/v1/auth/register",
      headers: from(1),
      body: { name: "Asha Rao", email: email.toUpperCase(), password: PASSWORD },
    });
    expect(registered.status).toBe(201);
    expect(registered.json.data).toEqual({ verification: expect.objectContaining({ email }) });
    expect(cookie(session.ACCESS_COOKIE)).toBeUndefined();
    const pending = cookie(EMAIL_VERIFICATION_COOKIE);
    expect(pending).toBeTruthy();

    // Only a keyed hash of the code is stored.
    const message = sentEmails.at(-1);
    expect(message).toMatchObject({ to: email, isChange: false, minutes: 10 });
    const stored = await models.User.findOne({ email }).select("+emailVerification.codeHash").lean();
    expect(stored).toMatchObject({ isEmailVerified: false, emailVerification: { pendingEmail: email, attempts: 0 } });
    expect(stored.emailVerification.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(message.code);

    // The right code alone opens nothing: it takes the browser that registered.
    expect((await call(routes.signInCode.POST, { method: "POST", headers: from(1), body: { code: message.code } })).status).toBe(401);

    cookieJar.set(EMAIL_VERIFICATION_COOKIE, pending);
    const wrong = await call(routes.signInCode.POST, { keep: true, method: "POST", headers: from(1), body: { code: otherCode(message.code) } });
    expect(wrong.status).toBe(422);
    expect(cookie(session.ACCESS_COOKIE)).toBeUndefined();

    // Typed with a space, as people copy it.
    const spaced = `${message.code.slice(0, 3)} ${message.code.slice(3)}`;
    const verified = await call(routes.signInCode.POST, { keep: true, method: "POST", headers: from(1), body: { code: spaced } });
    expect(verified.status).toBe(200);
    expect(verified.json.data.user).toMatchObject({ email, isEmailVerified: true });
    expect(cookie(EMAIL_VERIFICATION_COOKIE)).toBeUndefined();
    const accessToken = cookie(session.ACCESS_COOKIE);
    expect((await call(routes.profile.GET, { token: accessToken })).json.data.profile).toMatchObject({ email, isEmailVerified: true });
  });

  it("asks an unverified account for a code at sign-in and no longer honours its old sessions", async () => {
    const user = await createUser("customer", { isEmailVerified: false });
    expect((await call(routes.profile.GET, { as: user })).status).toBe(401);

    const signIn = () =>
      call(routes.login.POST, { method: "POST", path: "/api/v1/auth/login", headers: from(2), body: { email: user.email, password: PASSWORD } });
    const login = await signIn();
    expect(login.status).toBe(200);
    expect(login.json.data).toEqual({ verification: expect.objectContaining({ email: user.email }) });
    expect(cookie(session.ACCESS_COOKIE)).toBeUndefined();
    const first = sentEmails.at(-1);

    // Signing in again during the cooldown keeps the code on its way; an explicit resend is refused.
    await signIn();
    expect(sentEmails.at(-1)).toBe(first);
    const early = await call(routes.signInResend.POST, { keep: true, method: "POST" });
    expect(early.status).toBe(429);

    // Every guess counts, so the code dies after five wrong ones: even the right one fails then.
    for (let attempt = 4; attempt >= 0; attempt -= 1) {
      const guess = await call(routes.signInCode.POST, { keep: true, method: "POST", headers: from(2), body: { code: otherCode(first.code) } });
      expect(guess.json.errors[0].message).toBe(attempt ? `That code isn't right. ${attempt} ${attempt === 1 ? "attempt" : "attempts"} left.` : "That code isn't right. Request a new one.");
    }
    const locked = await call(routes.signInCode.POST, { keep: true, method: "POST", headers: from(2), body: { code: first.code } });
    expect(locked.json.errors[0].message).toBe("This code has expired. Request a new one.");

    // A locked code can be replaced at once.
    const resent = await call(routes.signInResend.POST, { keep: true, method: "POST" });
    expect(resent.status).toBe(200);
    const second = sentEmails.at(-1);
    expect(second).not.toBe(first);
    const verified = await call(routes.signInCode.POST, { keep: true, method: "POST", headers: from(2), body: { code: second.code } });
    expect(verified.status).toBe(200);
    expect(cookie(session.ACCESS_COOKIE)).toBeTruthy();
    expect((await models.User.findById(user._id).lean()).isEmailVerified).toBe(true);

    // Verified accounts sign straight in.
    const direct = await signIn();
    expect(direct.json.data.user).toMatchObject({ email: user.email });
  });

  it("cancels a waiting sign-in when the password is reset", async () => {
    const user = await createUser("customer", { isEmailVerified: false });
    await call(routes.login.POST, { method: "POST", path: "/api/v1/auth/login", headers: from(3), body: { email: user.email, password: PASSWORD } });
    const { code } = sentEmails.at(-1);
    await models.User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });

    const result = await call(routes.signInCode.POST, { keep: true, method: "POST", headers: from(3), body: { code } });
    expect(result.status).toBe(401);
    expect(cookie(session.ACCESS_COOKIE)).toBeUndefined();
  });
});

describe("preferences", () => {
  it("persists categories independently and timestamps promotional consent", async () => {
    const user = await createUser();
    const updated = await call(routes.preferences.PATCH, { as: user, method: "PATCH", body: { promotional: true, shippingUpdates: false } });
    expect(updated.status).toBe(200);
    expect(updated.json.data).toMatchObject({ orderUpdates: true, shippingUpdates: false, promotional: true });
    expect(updated.json.data.promotionalConsentAt).toBeTruthy();

    const reloaded = await call(routes.preferences.GET, { as: await models.User.findById(user._id) });
    expect(reloaded.json.data).toMatchObject({ orderUpdates: true, shippingUpdates: false, promotional: true });

    const empty = await call(routes.preferences.PATCH, { as: user, method: "PATCH", body: { unknown: true } });
    expect(empty.status).toBe(422);
  });
});

describe("privacy", () => {
  it("exports personal data without credentials or internal notes", async () => {
    const user = await createUser();
    await addAddress(user);
    await orderFixture(user);
    const result = await call(routes.exportData.GET, { as: await models.User.findById(user._id) });
    expect(result.status).toBe(200);
    expect(result.headers.get("content-disposition")).toContain("attachment");
    expect(result.json.profile.email).toBe(user.email);
    expect(result.json.addresses).toHaveLength(1);
    expect(result.json.orders).toHaveLength(1);
    const serialized = JSON.stringify(result.json);
    for (const secret of ['"password"', "tokenHash", "sessionVersion", "internalNotes", "staff only"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("requires re-authentication and explicit confirmation to request deletion", async () => {
    const user = await createUser();
    const wrongPassword = await call(routes.deletion.POST, { as: user, method: "POST", body: { currentPassword: "nope", confirmation: "DELETE" } });
    expect(wrongPassword.status).toBe(422);
    const noConfirmation = await call(routes.deletion.POST, { as: user, method: "POST", body: { currentPassword: PASSWORD, confirmation: "delete" } });
    expect(fieldsOf(noConfirmation)).toEqual(["confirmation"]);

    const requested = await call(routes.deletion.POST, { as: user, method: "POST", body: { currentPassword: PASSWORD, confirmation: "DELETE", reason: "Closing business" } });
    expect(requested.status).toBe(201);
    expect(requested.json.data.status).toBe("pending");
    const duplicate = await call(routes.deletion.POST, { as: user, method: "POST", body: { currentPassword: PASSWORD, confirmation: "DELETE" } });
    expect(duplicate.status).toBe(409);

    const cancelled = await call(routes.deletion.DELETE, { as: user, method: "DELETE" });
    expect(cancelled.json.data.status).toBe("none");
  });

  it("anonymizes only settled accounts and preserves order records", async () => {
    const admin = await createUser("admin");
    const user = await createUser("customer", { phone: "9876543210", companyName: "Rao Textiles" });
    await addAddress(user);
    const openOrder = await orderFixture(user, { orderStatus: "processing" });
    await call(routes.deletion.POST, { as: user, method: "POST", body: { currentPassword: PASSWORD, confirmation: "DELETE" } });
    const params = { customerId: String(user._id) };

    const blocked = await call(routes.anonymize.POST, { as: admin, method: "POST", params });
    expect(blocked.status).toBe(409);
    expect(blocked.json.message).toContain("in progress");

    await models.Order.updateOne({ _id: openOrder._id }, { $set: { orderStatus: "delivered" } });
    const userToken = await session.signAccessToken(await models.User.findById(user._id));
    const done = await call(routes.anonymize.POST, { as: admin, method: "POST", params });
    expect(done.status).toBe(200);

    const stored = await models.User.findById(user._id).lean();
    expect(stored).toMatchObject({ name: "Deleted customer", phone: "", companyName: "", isActive: false, addresses: [] });
    expect(stored.email).toMatch(/@deleted\.invalid$/);
    expect(stored.deletionRequest.status).toBe("completed");
    expect(await models.Order.countDocuments({ customer: user._id })).toBe(1);
    expect((await models.Order.findById(openOrder._id).lean()).shippingAddress.fullName).toBe("Asha Rao");
    expect((await call(routes.profile.GET, { token: userToken })).status).toBe(401);
  });
});

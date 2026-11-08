/**
 * Home page features through their real route handlers: admin permissions,
 * cron security and idempotency, activity and analytics abuse controls,
 * newsletter double opt-in, guides, and store isolation throughout.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { signInto } from "../helpers/auth.js";

const cookieJar = new Map();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name, value) => cookieJar.set(name, value),
    delete: (name) => cookieJar.delete(name),
  }),
  headers: async () => new Headers(),
}));

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
let mongo;
let m;
let storeA;
let storeB;
let productA;
let productB;
const users = {};

/** A request to a store's API as a same-origin browser, unless headers say otherwise. */
function request(host, pathname, { method = "GET", body, headers = {}, ip = "203.0.113.10" } = {}) {
  return new Request(`http://${host}${pathname}`, {
    method,
    headers: {
      host,
      "user-agent": BROWSER,
      "sec-fetch-site": "same-origin",
      "x-real-ip": ip,
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function signIn(user) {
  cookieJar.clear();
  if (!user) return;
  await m.runWithTenant(String(user.tenantId), () => signInto(cookieJar, user));
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("norosilk_home_security_test");
  await (await import("@/lib/db/connect")).connectDB();
  m = {
    Tenant: (await import("@/lib/db/models/Tenant")).Tenant,
    User: (await import("@/lib/db/models/User")).User,
    Category: (await import("@/lib/db/models/Category")).Category,
    Product: (await import("@/lib/db/models/Product")).Product,
    JobRun: (await import("@/lib/db/models/JobRun")).JobRun,
    ProductActivity: (await import("@/lib/db/models/ProductActivity")).ProductActivity,
    AnalyticsDaily: (await import("@/lib/db/models/AnalyticsDaily")).AnalyticsDaily,
    NewsletterSubscriber: (await import("@/lib/db/models/NewsletterSubscriber")).NewsletterSubscriber,
    session: await import("@/lib/auth/session"),
    ...(await import("@/lib/tenant/context")),
    ...(await import("@/lib/jobs/product-metrics.job")),
    ...(await import("@/lib/services/newsletter.service")),
    ...(await import("@/lib/services/analytics.service")),
    ...(await import("@/lib/services/guide.service")),
    ...(await import("@/lib/content/guides")),
    routes: {
      homepage: await import("@/app/api/v1/admin/homepage/route"),
      guides: await import("@/app/api/v1/admin/guides/route"),
      newsletterAdmin: await import("@/app/api/v1/admin/newsletter/route"),
      analyticsAdmin: await import("@/app/api/v1/admin/analytics/route"),
      metricsAdmin: await import("@/app/api/v1/admin/jobs/product-metrics/route"),
      cron: await import("@/app/api/cron/product-metrics/route"),
      activity: await import("@/app/api/v1/catalog/activity/route"),
      analytics: await import("@/app/api/v1/analytics/events/route"),
      recommendations: await import("@/app/api/v1/catalog/recommendations/route"),
      newsletter: await import("@/app/api/v1/newsletter/route"),
    },
  };
  await Promise.all([m.JobRun.init(), m.NewsletterSubscriber.init(), m.AnalyticsDaily.init(), m.ProductActivity.init()]);

  storeA = String((await m.Tenant.create({ slug: "a", name: "Store A", domains: ["a.test"] }))._id);
  storeB = String((await m.Tenant.create({ slug: "b", name: "Store B", domains: ["b.test"], salesMode: "retail" }))._id);
  for (const [tenantId, holder] of [[storeA, "A"], [storeB, "B"]]) {
    await m.runWithTenant(tenantId, async () => {
      const category = await m.Category.create({ name: "Silk", slug: "silk" });
      const product = await m.Product.create({ name: `Silk ${holder}`, slug: "silk-saree", sku: `S-${holder}`, category: category._id, price: 1000, wholesalePrice: 700, stockQuantity: 5, status: "active" });
      if (holder === "A") productA = product;
      else productB = product;
      for (const adminRole of ["owner", "manager", "staff"]) {
        users[`${holder}-${adminRole}`] = await m.User.create({ name: `${adminRole} ${holder}`, email: `${adminRole}@${holder}.test`, password: "x".repeat(60), role: "admin", adminRole });
      }
      users[`${holder}-customer`] = await m.User.create({ name: `Customer ${holder}`, email: `c@${holder}.test`, password: "x".repeat(60) });
    });
  }
  // Starting MongoDB and importing every route handler is slow when the whole suite runs in parallel.
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(() => cookieJar.clear());

describe("admin permissions (Marketing)", () => {
  const sections = [{ key: "hero", type: "hero", enabled: true }, { key: "feed", type: "feed", enabled: true }];

  it("lets owners and managers edit the home page", async () => {
    await signIn(users["A-owner"]);
    expect((await m.routes.homepage.PUT(request("a.test", "/api/v1/admin/homepage", { method: "PUT", body: { sections } }))).status).toBe(200);
    await signIn(users["A-manager"]);
    expect((await m.routes.homepage.GET(request("a.test", "/api/v1/admin/homepage"))).status).toBe(200);
  });

  it("refuses staff, customers and anonymous callers on every marketing endpoint", async () => {
    const calls = [
      () => m.routes.homepage.GET(request("a.test", "/api/v1/admin/homepage")),
      () => m.routes.homepage.PUT(request("a.test", "/api/v1/admin/homepage", { method: "PUT", body: { sections: [{ key: "feed", type: "feed" }] } })),
      () => m.routes.homepage.DELETE(request("a.test", "/api/v1/admin/homepage", { method: "DELETE" })),
      () => m.routes.guides.POST(request("a.test", "/api/v1/admin/guides", { method: "POST", body: { title: "Staff guide" } })),
      () => m.routes.newsletterAdmin.GET(request("a.test", "/api/v1/admin/newsletter?format=csv")),
      () => m.routes.analyticsAdmin.GET(request("a.test", "/api/v1/admin/analytics")),
    ];
    for (const [who, expected] of [["A-staff", 403], ["A-customer", 403], [null, 401]]) {
      await signIn(who ? users[who] : null);
      for (const call of calls) expect((await call()).status, `${who} ${call}`).toBe(expected);
    }
    // The staff attempts changed nothing.
    const layout = await m.runWithTenant(storeA, () => mongoose.model("HomepageLayout").findOne({}).lean());
    expect(layout.sections.map((section) => section.type)).toContain("hero");
  });

  it("does not accept an admin of another store", async () => {
    await signIn(users["B-owner"]);
    expect((await m.routes.homepage.GET(request("a.test", "/api/v1/admin/homepage"))).status).toBe(401);
  });

  it("limits manual metric runs to roles that can run jobs", async () => {
    await signIn(users["A-staff"]);
    expect((await m.routes.metricsAdmin.POST(request("a.test", "/api/v1/admin/jobs/product-metrics", { method: "POST" }))).status).toBe(403);
    await signIn(users["A-manager"]);
    expect((await m.routes.metricsAdmin.POST(request("a.test", "/api/v1/admin/jobs/product-metrics", { method: "POST" }))).status).toBe(200);
  });
});

describe("product metrics cron", () => {
  const cronRequest = (authorization) =>
    request("platform.test", "/api/cron/product-metrics", { headers: authorization ? { authorization } : {} });

  it("rejects missing or wrong secrets and refuses to run unconfigured", async () => {
    delete process.env.CRON_SECRET;
    expect((await m.routes.cron.GET(cronRequest("Bearer anything"))).status).toBe(503);
    process.env.CRON_SECRET = "s3cret-value-for-tests";
    expect((await m.routes.cron.GET(cronRequest())).status).toBe(401);
    expect((await m.routes.cron.GET(cronRequest("Bearer wrong"))).status).toBe(401);
    expect((await m.routes.cron.GET(cronRequest("s3cret-value-for-tests-but-longer"))).status).toBe(401);
  });

  it("runs once per store with the right secret", async () => {
    process.env.CRON_SECRET = "s3cret-value-for-tests";
    const response = await m.routes.cron.GET(cronRequest("Bearer s3cret-value-for-tests"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.map((run) => [run.tenant, run.status])).toEqual([["a", "success"], ["b", "success"]]);
  });

  it("gives identical results when run repeatedly", async () => {
    await m.runWithTenant(storeA, () =>
      m.ProductActivity.create({ product: productA._id, day: new Date(Date.now() - 86400000), views: 30, wishlists: 3, carts: 2 }),
    );
    const snapshot = () => m.runWithTenant(storeA, () => m.Product.findById(productA._id).select("popularityScore trendingScore salesCount").lean());
    const now = new Date();
    await m.runWithTenant(storeA, () => m.recomputeProductMetrics({ now }));
    const first = await snapshot();
    await m.runWithTenant(storeA, () => m.recomputeProductMetrics({ now }));
    await m.runWithTenant(storeA, () => m.recomputeProductMetrics({ now }));
    expect(await snapshot()).toEqual(first);
    expect(first.popularityScore).toBeGreaterThan(0);
    // Store B was not touched by store A's activity.
    expect((await m.runWithTenant(storeB, () => m.Product.findById(productB._id).lean())).popularityScore).toBe(0);
  });

  it("never runs twice at once, and recovers from a crashed run", async () => {
    const [one, two] = await Promise.all([
      m.runWithTenant(storeA, () => m.runProductMetricsJob({ triggeredBy: "test" })),
      m.runWithTenant(storeA, () => m.runProductMetricsJob({ triggeredBy: "test" })),
    ]);
    expect([one.status, two.status].sort()).toEqual(["skipped", "success"]);

    // A run that died mid-way leaves its lock; it is released once stale.
    await m.runWithTenant(storeA, () => m.JobRun.create({ jobName: "product_metrics", status: "running", startedAt: new Date(Date.now() - 60 * 60 * 1000), lockKey: "product_metrics" }));
    const recovered = await m.runWithTenant(storeA, () => m.runProductMetricsJob({ triggeredBy: "test" }));
    expect(recovered.status).toBe("success");
    const abandoned = await m.runWithTenant(storeA, () => m.JobRun.countDocuments({ errorSummary: /Abandoned/ }));
    expect(abandoned).toBe(1);
    // A store's lock never blocks another store.
    await m.runWithTenant(storeA, () => m.JobRun.create({ jobName: "product_metrics", status: "running", startedAt: new Date(), lockKey: "product_metrics" }));
    expect((await m.runWithTenant(storeB, () => m.runProductMetricsJob({ triggeredBy: "test" }))).status).toBe("success");
  });
});

describe("activity tracking abuse controls", () => {
  const view = (host, productId, options = {}) =>
    m.routes.activity.POST(request(host, "/api/v1/catalog/activity", { method: "POST", body: { productId: String(productId), type: "view" }, ...options })).then((response) => response.json());

  it("ignores bots and cross-site posts without telling them", async () => {
    expect((await view("a.test", productA._id, { headers: { "user-agent": "python-requests/2.31" }, ip: "198.51.100.1" })).data).toEqual({ counted: false });
    expect((await view("a.test", productA._id, { headers: { "sec-fetch-site": "cross-site" }, ip: "198.51.100.2" })).data).toEqual({ counted: false });
  });

  it("caps each client per hour across products", async () => {
    await m.runWithTenant(storeA, async () => {
      const category = await m.Category.findOne({ slug: "silk" });
      const docs = await m.Product.insertMany(
        Array.from({ length: 62 }, (_, index) => ({ name: `Cap ${index}`, slug: `cap-${index}`, sku: `CAP-${index}`, category: category._id, price: 1, wholesalePrice: 1, status: "active", tenantId: storeA })),
      );
      const results = [];
      for (const doc of docs) results.push((await view("a.test", doc._id, { ip: "198.51.100.50" })).data.counted);
      expect(results.filter(Boolean)).toHaveLength(60);
      expect(results.slice(-2)).toEqual([false, false]);
    });
  });

  it("only counts products of the store being visited, with separate limits per store", async () => {
    expect((await view("a.test", productB._id, { ip: "198.51.100.60" })).data).toEqual({ counted: false });
    expect((await view("a.test", productA._id, { ip: "198.51.100.60" })).data).toEqual({ counted: true });
    expect((await view("b.test", productB._id, { ip: "198.51.100.60" })).data).toEqual({ counted: true });
    const rowsInB = await m.runWithTenant(storeB, () => m.ProductActivity.find({}).lean());
    expect(rowsInB.every((row) => String(row.product) === String(productB._id))).toBe(true);
  });
});

describe("personalised content is never shared", () => {
  it("marks recommendation responses private and uncacheable", async () => {
    const response = await m.routes.recommendations.GET(request("a.test", `/api/v1/catalog/recommendations?viewed=${productA._id}`));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps request-specific code out of every cached function", () => {
    const root = path.resolve(import.meta.dirname, "../../lib");
    const files = (dir) => readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      return statSync(full).isDirectory() ? files(full) : /\.(js|ts)$/.test(entry) ? [full] : [];
    });
    const cached = files(root).filter((file) => readFileSync(file, "utf8").includes('"use cache"'));
    expect(cached.length).toBeGreaterThan(3);
    for (const file of cached) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/getAuthUser|next\/headers|cookies\(\)|getAdminSession/);
    }
    expect(readFileSync(path.join(root, "catalog/recommendations.js"), "utf8")).not.toContain('"use cache"');
  });
});

describe("newsletter", () => {
  let sent;
  beforeEach(() => {
    sent = [];
    process.env.RESEND_API_KEY = "test-key";
    process.env.NOTIFY_EMAIL_FROM = "Store <hello@store.test>";
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return Response.json({ id: "email-1" });
    }));
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFY_EMAIL_FROM;
  });
  const tokenFrom = (email, kind) => new RegExp(`/newsletter/${kind}\\?token=([A-Za-z0-9_-]+)`).exec(email.body.text)[1];

  it("confirms by email (double opt-in), once", async () => {
    await m.runWithTenant(storeA, async () => {
      expect(await m.subscribeToNewsletter({ email: "Buyer@Example.com" })).toEqual({ status: "pending" });
      expect(sent).toHaveLength(1);
      expect(sent[0].body.to).toEqual(["buyer@example.com"]);
      expect(sent[0].body.text).toContain("https://a.test/newsletter/confirm?token=");
      const token = tokenFrom(sent[0], "confirm");
      const stored = await m.NewsletterSubscriber.findOne({ email: "buyer@example.com" }).lean();
      expect(stored.confirmTokenHash).toBe(m.hashToken(token)); // only the hash is stored
      expect(JSON.stringify(stored)).not.toContain(token);

      expect(await m.confirmNewsletter({ token })).toEqual({ status: "subscribed" });
      await expect(m.confirmNewsletter({ token })).rejects.toThrow(/expired or was already used/);

      // Already subscribed: same answer, no email, nothing revealed.
      expect(await m.subscribeToNewsletter({ email: "buyer@example.com" })).toEqual({ status: "pending" });
      expect(sent).toHaveLength(1);

      await m.unsubscribeNewsletter({ token: tokenFrom(sent[0], "unsubscribe") });
      expect((await m.NewsletterSubscriber.findOne({ email: "buyer@example.com" }).lean()).status).toBe("unsubscribed");
    });
  });

  it("does not let the form be used to flood someone's inbox", async () => {
    await m.runWithTenant(storeA, async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) await m.subscribeToNewsletter({ email: "target@example.com" });
      expect(sent.filter((email) => email.body.to.includes("target@example.com"))).toHaveLength(3);
    });
  });

  it("rate limits sign-ups per client and validates input", async () => {
    const post = (email) => m.routes.newsletter.POST(request("b.test", "/api/v1/newsletter", { method: "POST", body: { email }, ip: "198.51.100.77" }));
    expect((await post("not-an-email")).status).toBe(422);
    for (let attempt = 0; attempt < 9; attempt += 1) await post(`p${attempt}@example.com`);
    expect((await post("one-too-many@example.com")).status).toBe(429);
  });

  it("keeps each store's list separate and exports safely", async () => {
    await m.runWithTenant(storeB, () => m.subscribeToNewsletter({ email: "buyer@example.com" }));
    const inB = await m.runWithTenant(storeB, () => m.NewsletterSubscriber.findOne({ email: "buyer@example.com" }).lean());
    expect(inB.status).toBe("pending");
    await m.runWithTenant(storeA, () =>
      m.NewsletterSubscriber.create({ email: "=cmd@example.com", status: "subscribed", consentAt: new Date(), unsubscribeTokenHash: "x" }),
    );
    const csv = await m.runWithTenant(storeA, () => m.exportSubscribersCsv());
    expect(csv).toContain(`"'=cmd@example.com"`);
    expect(csv).not.toContain("target@example.com"); // unconfirmed
  });

  it("subscribes directly when the store cannot send email", async () => {
    delete process.env.RESEND_API_KEY;
    await m.runWithTenant(storeB, async () => {
      expect(await m.subscribeToNewsletter({ email: "direct@example.com" })).toEqual({ status: "subscribed" });
      expect((await m.NewsletterSubscriber.findOne({ email: "direct@example.com" }).lean()).confirmedAt).toBeTruthy();
    });
    expect(sent).toHaveLength(0);
  });
});

describe("analytics", () => {
  const send = (host, events, options = {}) =>
    m.routes.analytics.POST(request(host, "/api/v1/analytics/events", { method: "POST", body: { events }, ...options }));

  it("merges a batch into daily counters per store", async () => {
    const events = [
      { event: "section_view", section: "for-you" },
      { event: "section_view", section: "for-you" },
      { event: "product_click", section: "for-you", target: "silk-saree" },
      { event: "category_click", section: "catalogue", target: "silk" },
    ];
    expect((await send("a.test", events)).status).toBe(202);
    expect((await send("b.test", [{ event: "section_view", section: "for-you" }])).status).toBe(202);

    const report = await m.runWithTenant(storeA, () => m.getHomepageAnalytics({ days: 7 }));
    const forYou = report.sections.find((section) => section.key === "for-you");
    expect(forYou).toMatchObject({ views: 2, clicks: 1, clickRate: 50 });
    expect(report.topProducts).toEqual([{ target: "silk-saree", label: "Silk A", count: 1 }]);
    expect(report.topCategories).toEqual([{ target: "silk", label: "Silk", count: 1 }]);
    const reportB = await m.runWithTenant(storeB, () => m.getHomepageAnalytics({ days: 7 }));
    expect(reportB.sections.find((section) => section.key === "for-you").views).toBe(1);
  });

  it("rejects unknown events and free text, and ignores bots", async () => {
    expect((await send("a.test", [{ event: "page_hack" }])).status).toBe(422);
    expect((await send("a.test", [{ event: "search_submit", target: "my phone 98765 43210" }])).status).toBe(422);
    expect((await send("a.test", Array.from({ length: 26 }, () => ({ event: "section_view" })))).status).toBe(422);
    const bot = await send("a.test", [{ event: "section_view", section: "hero" }], { headers: { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" } });
    expect((await bot.json()).data).toEqual({ recorded: 0 });
  });
});

describe("buying guides", () => {
  const admin = { _id: new mongoose.Types.ObjectId() };
  const cover = { url: "https://res.cloudinary.com/demo/image/upload/guide.jpg", width: 1600, height: 900 };

  it("publishes only complete guides, per store, with unique addresses", async () => {
    await m.runWithTenant(storeA, async () => {
      await expect(m.createGuide({ title: "Empty guide", status: "published" }, admin)).rejects.toThrow(/at least one section/);
      const draft = await m.createGuide({ title: "Silk care basics", sections: [{ heading: "Storage", body: "Fold in muslin." }] }, admin);
      expect(draft.slug).toBe("silk-care-basics");
      await expect(m.createGuide({ title: "Silk care basics" }, admin)).rejects.toThrow(/already uses/);
      expect(await m.getPublishedGuides(storeA)).toHaveLength(0);

      await m.updateGuide(draft.id, { status: "published" }, admin);
      await m.createGuide({ title: "Banarasi explained", coverImage: cover, status: "published", sections: [{ heading: "Zari", body: "Real zari is silver." }] }, admin);
    });
    expect((await m.getPublishedGuides(storeA)).map((guide) => guide.slug)).toEqual(["banarasi-explained", "silk-care-basics"]);
    expect((await m.getPublishedGuides(storeA, { withCover: true })).map((guide) => guide.slug)).toEqual(["banarasi-explained"]);
    expect(await m.getPublishedGuide(storeA, "silk-care-basics")).toMatchObject({ readingMinutes: 1, sections: [{ heading: "Storage" }] });
    expect(await m.getPublishedGuides(storeB)).toEqual([]);
    expect(await m.getPublishedGuide(storeB, "silk-care-basics")).toBeNull();
  });
});

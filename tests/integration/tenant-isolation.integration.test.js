/**
 * Proves stores cannot see or modify each other's data, using two tenants in
 * an in-memory MongoDB.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const cookieJar = new Map();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name) => (cookieJar.get(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name, value) => cookieJar.set(name, value),
  }),
}));

let mongo;
let Tenant;
let Category;
let User;
let runWithTenant;
let session;
let storeA;
let storeB;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("norosilk_tenancy_test");
  await (await import("@/lib/db/connect")).connectDB();
  ({ Tenant } = await import("@/lib/db/models/Tenant"));
  ({ Category } = await import("@/lib/db/models/Category"));
  ({ User } = await import("@/lib/db/models/User"));
  ({ runWithTenant } = await import("@/lib/tenant/context"));
  session = await import("@/lib/auth/session");
  await Promise.all([Category.syncIndexes(), User.syncIndexes()]);

  storeA = String((await Tenant.create({ slug: "store-a", name: "Store A", domains: ["a.test"] }))._id);
  storeB = String((await Tenant.create({ slug: "store-b", name: "Store B", domains: ["b.test"] }))._id);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("tenant scoping", () => {
  it("refuses queries and writes without a tenant context", async () => {
    await expect(Category.find({}).lean()).rejects.toThrow(/Tenant context missing/);
    await expect(Category.create({ name: "Orphan", slug: "orphan" })).rejects.toThrow(/Tenant context missing/);
  });

  it("stamps new documents and hides them from other stores", async () => {
    const created = await runWithTenant(storeA, () => Category.create({ name: "Silk", slug: "silk" }));
    expect(String(created.tenantId)).toBe(storeA);

    const fromB = await runWithTenant(storeB, () => Category.findById(created._id).lean());
    expect(fromB).toBeNull();
    const countFromB = await runWithTenant(storeB, () => Category.countDocuments({}));
    expect(countFromB).toBe(0);
    const aggregateFromB = await runWithTenant(storeB, () => Category.aggregate([{ $match: {} }]));
    expect(aggregateFromB).toEqual([]);
  });

  it("cannot update or delete another store's documents", async () => {
    const doc = await runWithTenant(storeA, () => Category.create({ name: "Cotton", slug: "cotton" }));
    const update = await runWithTenant(storeB, () => Category.updateOne({ _id: doc._id }, { $set: { name: "Hijacked" } }));
    expect(update.matchedCount).toBe(0);
    const removed = await runWithTenant(storeB, () => Category.deleteOne({ _id: doc._id }));
    expect(removed.deletedCount).toBe(0);
    const intact = await runWithTenant(storeA, () => Category.findById(doc._id).lean());
    expect(intact.name).toBe("Cotton");
  });

  it("rejects filters that name a different store", async () => {
    await expect(
      runWithTenant(storeB, () => Category.find({ tenantId: storeA }).lean()),
    ).rejects.toThrow(/another tenant/);
  });

  it("enforces uniqueness per store, not globally", async () => {
    await runWithTenant(storeA, () => Category.create({ name: "Linen", slug: "linen" }));
    await expect(runWithTenant(storeB, () => Category.create({ name: "Linen", slug: "linen" }))).resolves.toBeTruthy();
    await expect(runWithTenant(storeA, () => Category.create({ name: "Linen 2", slug: "linen" }))).rejects.toThrow(/duplicate key/);
  });
});

describe("sessions", () => {
  it("does not accept a customer token issued by another store", async () => {
    const user = await runWithTenant(storeA, () =>
      User.create({ name: "Asha Rao", email: "asha@example.com", password: "x".repeat(60) }),
    );
    const token = await runWithTenant(storeA, () => session.signAccessToken(user));
    cookieJar.set(session.ACCESS_COOKIE, token);

    await expect(runWithTenant(storeA, () => session.getAuthUser())).resolves.toMatchObject({ email: "asha@example.com" });
    await expect(runWithTenant(storeB, () => session.getAuthUser())).resolves.toBeNull();
  });

  it("allows the same email to register in two stores", async () => {
    await expect(
      runWithTenant(storeB, () => User.create({ name: "Asha Rao", email: "asha@example.com", password: "y".repeat(60) })),
    ).resolves.toBeTruthy();
  });
});

/**
 * Home page banners: validation, scheduling, ordering and store isolation.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;
let m;
let storeA;
let storeB;
const admin = { _id: new mongoose.Types.ObjectId() };
const image = { url: "https://res.cloudinary.com/demo/image/upload/banner.jpg", width: 1920, height: 800 };
const hour = 60 * 60 * 1000;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("norosilk_banner_test");
  await (await import("@/lib/db/connect")).connectDB();
  m = {
    Tenant: (await import("@/lib/db/models/Tenant")).Tenant,
    ...(await import("@/lib/tenant/context")),
    ...(await import("@/lib/services/banner.service")),
    ...(await import("@/lib/content/banners")),
  };
  storeA = String((await m.Tenant.create({ slug: "a", name: "A", domains: ["a.test"] }))._id);
  storeB = String((await m.Tenant.create({ slug: "b", name: "B", domains: ["b.test"] }))._id);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("banner validation", () => {
  it("rejects unsafe links and half-filled buttons", async () => {
    await m.runWithTenant(storeA, async () => {
      await expect(
        m.createBanner({ name: "x", title: "x", image, primaryCta: { label: "Go", href: "javascript:alert(1)" } }, admin),
      ).rejects.toThrow(/page path/);
      await expect(m.createBanner({ name: "x", title: "x", image, primaryCta: { label: "Go", href: "" } }, admin)).rejects.toThrow(/both/);
      await expect(
        m.createBanner({ name: "x", title: "x", image: { ...image, url: "http://insecure.test/a.jpg" } }, admin),
      ).rejects.toThrow(/https/);
    });
  });

  it("rejects an end date before the start date", async () => {
    await m.runWithTenant(storeA, async () => {
      const now = Date.now();
      await expect(
        m.createBanner({ name: "x", title: "x", image, startsAt: new Date(now + hour), endsAt: new Date(now) }, admin),
      ).rejects.toThrow(/after the start/);
    });
  });
});

describe("live banners", () => {
  it("shows active banners in the store's order, honouring schedules", async () => {
    const now = Date.now();
    await m.runWithTenant(storeA, async () => {
      const first = await m.createBanner({ name: "Sale", title: "Festive sale", image, primaryCta: { label: "Shop", href: "/products" } }, admin);
      await m.createBanner({ name: "Later", title: "Coming soon", image, startsAt: new Date(now + hour) }, admin);
      await m.createBanner({ name: "Ended", title: "Old", image, endsAt: new Date(now - hour) }, admin);
      await m.createBanner({ name: "Hidden", title: "Hidden", image, isActive: false }, admin);
      const second = await m.createBanner({ name: "Bridal", title: "Bridal edit", image }, admin);

      const statuses = Object.fromEntries((await m.listBanners()).map((banner) => [banner.name, banner.status]));
      expect(statuses).toEqual({ Sale: "live", Later: "scheduled", Ended: "ended", Hidden: "hidden", Bridal: "live" });

      expect((await m.getLiveBanners(storeA)).map((banner) => banner.title)).toEqual(["Festive sale", "Bridal edit"]);

      const ids = (await m.listBanners()).map((banner) => banner.id);
      const reordered = [second.id, ...ids.filter((id) => id !== second.id)];
      await m.reorderBanners({ ids: reordered });
      expect((await m.getLiveBanners(storeA)).map((banner) => banner.title)).toEqual(["Bridal edit", "Festive sale"]);

      // Partial updates leave other fields alone.
      await m.updateBanner(first.id, { subtitle: "Up to 30% off" }, admin);
      const updated = await m.getBanner(first.id);
      expect(updated).toMatchObject({ title: "Festive sale", subtitle: "Up to 30% off", primaryCta: { label: "Shop", href: "/products" } });
    });
  });

  it("never shows one store's banners on another", async () => {
    expect(await m.getLiveBanners(storeB)).toEqual([]);
    await expect(m.runWithTenant(storeB, () => m.reorderBanners({ ids: [String(new mongoose.Types.ObjectId())] }))).rejects.toThrow(/changed/);
  });
});

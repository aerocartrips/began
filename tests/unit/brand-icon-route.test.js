/**
 * The favicon routes (app/[domain]/icons, app/[domain]/favicon.ico): a store's
 * own icon resized to a square, or a generated monogram PNG of the exact size.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ current: null }));
vi.mock("@/lib/seo/sitemap", () => ({ tenantForDomain: async () => store.current }));

const { GET: icon } = await import("@/app/[domain]/icons/[file]/route");
const { GET: favicon } = await import("@/app/[domain]/favicon.ico/route");

const tenant = {
  name: "Silk House",
  slug: "silk-house",
  branding: { siteTitle: "Silk House", faviconUrl: "", theme: { brand: "#6863ed" } },
};
const request = (path) => new Request(`http://silks.example${path}`);
const params = (file) => ({ params: Promise.resolve({ domain: "silks.example", file }) });

/** Width and height from a PNG's IHDR chunk. */
async function pngSize(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer);
  expect([...bytes.slice(1, 4)].map((code) => String.fromCharCode(code)).join("")).toBe("PNG");
  return [view.getUint32(16), view.getUint32(20)];
}

beforeEach(() => {
  store.current = tenant;
});

describe("store icons", () => {
  it("draws a monogram PNG of the requested size when the store has no icon", async () => {
    const response = await icon(request("/icons/icon-192.png"), params("icon-192.png"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(await pngSize(response)).toEqual([192, 192]);
    expect(await pngSize(await icon(request("/icons/apple-touch-icon.png"), params("apple-touch-icon.png")))).toEqual([180, 180]);
  });

  it("sends the store's own icon, resized to a square on its CDN", async () => {
    store.current = { ...tenant, branding: { ...tenant.branding, faviconUrl: "https://res.cloudinary.com/demo/image/upload/v1/icon.png" } };
    const response = await icon(request("/icons/icon-48.png"), params("icon-48.png"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://res.cloudinary.com/demo/image/upload/c_pad,w_48,h_48,b_white,f_png/v1/icon.png");
  });

  it("answers 404 for other files and for hosts without a store", async () => {
    expect((await icon(request("/icons/logo.svg"), params("logo.svg"))).status).toBe(404);
    store.current = null;
    expect((await icon(request("/icons/icon-48.png"), params("icon-48.png"))).status).toBe(404);
  });

  it("points /favicon.ico at the 48px icon, versioned so browsers pick up branding changes", async () => {
    const response = await favicon(request("/favicon.ico"), { params: Promise.resolve({ domain: "silks.example" }) });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/^\/icons\/icon-48\.png\?v=[a-z0-9]+$/);
  });
});

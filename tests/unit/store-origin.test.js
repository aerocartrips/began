import { describe, expect, it } from "vitest";
import { isLocalHostname, requestOrigin, storeOriginFor } from "@/lib/tenant/host";
import { runWithTenant } from "@/lib/tenant/context";
import { getStoreOrigin } from "@/lib/tenant/active";
import { runAfterResponse } from "@/lib/utils/background";
import { emailCodeSchema } from "@/lib/validators/account.validator";

const store = { id: "64b7f0c2a1b2c3d4e5f60718", primaryDomain: "silks.example" };

describe("origins for links in emails", () => {
  it("uses https without a port for real domains, and http with the port for development hosts", () => {
    expect(requestOrigin("Silks.Example")).toBe("https://silks.example");
    expect(requestOrigin("silks.example:8443")).toBe("https://silks.example");
    expect(requestOrigin("localhost:3000")).toBe("http://localhost:3000");
    expect(requestOrigin("localhost")).toBe("http://localhost");
    expect(requestOrigin("shop.localhost:3001")).toBe("http://shop.localhost:3001");
    expect(requestOrigin("192.168.1.20:3000")).toBe("http://192.168.1.20:3000");
    expect(storeOriginFor("localhost", 3000)).toBe("http://localhost:3000");
    expect(isLocalHostname("localhost.silks.example")).toBe(false);
  });

  it("rejects hosts that aren't plain hostnames", () => {
    for (const host of [null, "", "evil.example/reset", "user@evil.example", "evil.example\r\nx: y", "[::1]:3000"]) {
      expect(requestOrigin(host)).toBeNull();
    }
  });

  it("follows the domain the request came in on, and falls back to the primary domain without one", async () => {
    expect(await runWithTenant(store, () => getStoreOrigin())).toBe("https://silks.example");
    expect(await runWithTenant(store, () => getStoreOrigin(), { origin: "https://www.silks.example" })).toBe("https://www.silks.example");
    expect(await runWithTenant({ ...store, primaryDomain: "localhost" }, () => getStoreOrigin())).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it("keeps the request's domain for work that runs after the response", async () => {
    const origin = await runWithTenant(
      store,
      () => new Promise((resolve) => runAfterResponse("test", async () => resolve(await getStoreOrigin()))),
      { origin: "http://localhost:3100" },
    );
    expect(origin).toBe("http://localhost:3100");
  });
});

describe("email verification codes", () => {
  it("accepts six digits as people paste them, and nothing else", () => {
    expect(emailCodeSchema.parse({ code: "123456" })).toEqual({ code: "123456" });
    expect(emailCodeSchema.parse({ code: " 123 456 " })).toEqual({ code: "123456" });
    expect(emailCodeSchema.parse({ code: "123-456" })).toEqual({ code: "123456" });
    for (const code of ["12345", "1234567", "12345a", "", "１２３４５６"]) {
      expect(emailCodeSchema.safeParse({ code }).success).toBe(false);
    }
  });
});

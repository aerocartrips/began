import { vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-with-32-byte-minimum-length";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-32-byte-minimum";
process.env.AUTH_SECRET = "test-auth-secret-with-32-byte-minimum-len";
process.env.TENANT_SECRETS_KEY = Buffer.alloc(32, 7).toString("base64");

// Next.js caching APIs only work inside a Next.js server; in tests cached functions run uncached.
vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
  updateTag: () => {},
}));

vi.mock("next/root-params", () => ({ domain: async () => "localhost" }));

// Route handlers are called directly in tests, outside a Next.js request, so
// there is nothing for connection() to wait for. Files that mock next/server
// themselves spread `connection` from tests/stubs/next-server.js.
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal()), ...(await import("./stubs/next-server.js")) }));

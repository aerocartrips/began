import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Store not found",
  robots: { index: false, follow: false },
};

/** Served for hostnames that are not mapped to any store (Tenant.domains). */
export default function GlobalNotFound() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  return (
    <html lang="en-IN">
      <body>
        <main className="commerce-page content-width" style={{ padding: "96px 0", textAlign: "center" }}>
          <h1>Store not found</h1>
          <p>This address is not connected to a store.</p>
          {isDevelopment ? (
            <div style={{ maxWidth: 680, margin: "32px auto 0", textAlign: "left" }}>
              <p>
                <strong>Development tip:</strong> no store in the database lists this hostname in its domains. Create
                one (or add the domain to an existing store), then reload:
              </p>
              <pre style={{ whiteSpace: "pre-wrap", padding: 16, borderRadius: 8, background: "#111827", color: "#f9fafb" }}>
                {`OWNER_PASSWORD='at-least-12-chars' npm run tenant:create -- \\\n  --slug mystore --name "My Store" --domain localhost --owner-email you@example.com`}
              </pre>
              <p>Upgrading an existing single-store database? See README → &quot;Upgrading an existing single-store database&quot;.</p>
            </div>
          ) : null}
        </main>
      </body>
    </html>
  );
}

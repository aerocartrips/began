# Norosilk

A multi-store saree commerce platform: one deployment serves many independent stores, each on its own domain, with its own catalogue, customers, orders, staff, branding and payment account. Each store sells either **wholesale** (minimum order quantities, quantity tiers, quote requests) or **retail** (single pieces). Prices are in Indian rupees (INR) everywhere.

Built with the Next.js App Router (Next.js 16, React 19, Cache Components), MongoDB/Mongoose, Razorpay, Cloudinary and Delhivery.

## Getting started

```bash
cp .env.example .env            # fill in MONGODB_URI and the secrets
npm install
OWNER_PASSWORD='choose-a-strong-one' npm run tenant:create -- \
  --slug demo --name "Demo Silks" --domain localhost --sales-mode wholesale --owner-email you@example.com
npm run seed:catalog -- --tenant demo   # optional sample catalogue
npm run dev                             # http://localhost:3000, admin at /admin
```

Requires Node.js 20.19+ (see `.nvmrc`) and MongoDB (Atlas or a replica set: orders use transactions).

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Development server, production build and server |
| `npm run check` | Lint, typecheck and tests (CI also runs `build`) |
| `npm run tenant:create` | Create or update a store, its domains, sales mode and owner account |
| `npm run tenant:integrations` | Store a store's Razorpay / Delhivery credentials (encrypted) |
| `npm run admin:create` | Create or update a staff account (`--role owner\|manager\|staff`) |
| `npm run tenant:migrate` | One-time upgrade of a single-store database (see below) |
| `npm run seed:catalog` | Sample attributes, categories and products (`--count 20000` for load tests) |
| `npm run format` | Prettier |

Scripts read secrets (passwords, API keys) from environment variables, never from arguments, so they don't end up in shell history.

## Stores (multi-tenancy)

- **Routing.** `proxy.ts` rewrites every page request to `app/[domain]/…`. The store is looked up by hostname in `Tenant.domains` (cached), so adding a domain needs no deploy. API routes resolve the store from the `Host` header. Unknown hosts get a "Store not found" page.
- **Data isolation.** Every store-owned collection uses `lib/db/plugins/tenant-scope.js`, which adds `tenantId` to every query, aggregate, insert and bulk write from the request's tenant context. Code that runs without a tenant context **fails** rather than reading across stores. All indexes start with `tenantId`; this is enforced by `tests/unit/tenant-indexes.test.js`. Two-store tests are in `tests/integration/tenant-isolation.integration.test.js`.
- **Establishing the tenant.** `withDatabase` (API routes), `withCurrentTenant` (server components), `getActionTenant` (server actions) and `runForEachTenant` (cron jobs). Cached functions take `tenantId` as an explicit argument so it is part of the cache key.
- **Sessions** are bound to the issuing store through the JWT audience, and cookies are host-only. A token from one store is rejected by every other store.
- **Store configuration** (Admin → Store settings): name, sales mode, title, tagline, logo and hero image, theme colours (CSS variables on `<html>`), contact details, legal and GST details, alert inbox, GST rate, shipping charges, order windows and pickup details.
- **Integration secrets** (Razorpay, Delhivery) are stored per store, encrypted with AES-256-GCM using `TENANT_SECRETS_KEY`, and never sent to the browser. Configure each store's Razorpay webhook as `https://<store domain>/api/v1/payments/webhook`.
- **Content pages** (about, FAQ, privacy, terms, shipping, returns, care guide) are per store (Admin → Pages). Until edited, they show a template filled with the store's details. Review policies with your adviser before going live.

### Upgrading an existing single-store database

```bash
npm run tenant:create -- --slug norosilk --name "Norosilk" --domain norosilk.com --domain www.norosilk.com
npm run tenant:migrate -- --tenant norosilk
RAZORPAY_KEY_ID=… RAZORPAY_KEY_SECRET=… RAZORPAY_WEBHOOK_SECRET=… npm run tenant:integrations -- --tenant norosilk
```

The migration assigns existing documents to the store and copies contact, business and env tax/shipping settings into it. It makes existing admins owners, relists sold-out products, and rebuilds indexes. It is safe to re-run. Back up the database first.

## Catalogue at scale

The storefront is server-rendered and built for 10k–50k products per store:

- `/products`, `/categories/[slug]` and search share one listing (`lib/catalog/query.js`), with filters, sort and page in the URL. Product pages use indexed `find().sort().skip().limit()`, and every sort is backed by an index ending in `_id`. Filter counts come from one slim `$facet` aggregation, cached separately from paging and sorting.
- Results are cached per store and per query (`"use cache"`), and invalidated by any product, category or attribute write.
- Search uses a weighted text index with a name-prefix fallback ("bana" finds Banarasi). Header autocomplete shows photos and prices.
- Colours are variants of one product (own SKU, stock and photos). Stock is reserved atomically per variant.
- Attribute values (fabric, weave, occasion, pattern, colour) come from per-store lists (Admin → Attributes), so filters stay consistent.
- Per-store `sitemap.xml` (an index with 10,000-URL product sitemaps), `robots.txt`, canonical URLs, and Product/FAQ structured data.

Cart and checkout keep only `{productId, variantId, quantity}` in the browser. Prices, tiers, MOQ, stock, GST and shipping always come from the server (`POST /api/v1/cart/price`), using the same rules as order creation (`lib/catalog/pricing.js`).

## Admin

Staff accounts belong to one store and have a role (`lib/auth/permissions.js`):

| Role | Can |
| --- | --- |
| Owner | Everything, including store settings, pages and staff |
| Manager | Catalogue, orders, customers, payments and refunds, quotes, support |
| Staff | Orders, quotes, support, reviews and returns |

Permissions are enforced on every admin API route and page. The navigation only shows what the role can use. A store always keeps at least one active owner.

## API conventions

Endpoints live under `/api/v1` and are wrapped in `withDatabase`, which returns a consistent shape:

```json
{ "success": true, "message": "…", "data": {}, "meta": {} }
{ "success": false, "message": "…", "errors": [{ "field": "email", "message": "…" }], "requestId": "…" }
```

Throw `ApiError(status, message, errors)` from services. Mongoose cast, validation and duplicate-key errors map to 400, 422 and 409. Anything else becomes a logged 500 with a `requestId` (also sent as `x-request-id`). Rate limits are stored in MongoDB, namespaced per store, and fall back to memory.

## Security headers

`next.config.mjs` sets a Content-Security-Policy, HSTS, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`. Store images (logo, hero, products) should be hosted on Cloudinary; add any other image host to `images.remotePatterns` and the CSP.

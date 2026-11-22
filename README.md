# Norosilk

A multi-store fashion commerce platform: one deployment serves many independent stores, each on its own domain, with its own catalogue, customers, orders, staff, branding and payment account. Each store chooses what it sells (sarees, T-shirts, jeans, kurtas, footwear or its own product types, one or several; see [Product types](#product-types)) and sells either **wholesale** (minimum order quantities, quantity tiers, quote requests) or **retail** (single pieces). Prices are in Indian rupees (INR) everywhere.

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
| `npm run catalog:upgrade` | One-time upgrade of a store's saree catalogue to product types (see below) |
| `npm run seed:catalog` | Sample attributes, a Saree product type, categories and products (`--count 20000` for load tests) |
| `npm run format` | Prettier |

Scripts read secrets (passwords, API keys) from environment variables, never from arguments, so they don't end up in shell history.

## Stores (multi-tenancy)

- **Routing.** `proxy.ts` rewrites every page request to `app/[domain]/…`. The store is looked up by hostname in `Tenant.domains` (cached), so adding a domain needs no deploy. API routes resolve the store from the `Host` header. Unknown hosts get a "Store not found" page.
- **Domains and links.** The first domain is the store's primary domain, used for canonical URLs, the sitemap, invoices and emails sent by jobs, so list the production domain first (`--domain shop.example.com --domain localhost`). Links in emails sent during a request (password reset, quotes, notifications) use the domain the shopper is on, e.g. `http://localhost:3000` in development.
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

### Upgrading a saree catalogue to product types

Stores created before product types keep selling, but until their products are upgraded to a type, product pages show no details (fabric, weave…) and listings offer no detail or colour filters. **Deploy this version first, then upgrade straight away**: the upgrade removes the old fields, which earlier versions of the app still read.

For a deployed store, use Admin → Product types → "Upgrade catalogue" (store owners): the page shows how many products still need it, and the button applies the upgrade and refreshes the store's cached pages at once. From the command line (local or staging databases, or to see a dry run first):

```bash
npm run catalog:upgrade -- --tenant norosilk           # dry run: prints what would change, writes nothing
npm run catalog:upgrade -- --tenant norosilk --apply   # converts the products
```

A script can't clear a running site's cache, so after a command-line upgrade a deployed store shows the change within the hour, or at its next catalogue save in the admin.

The upgrade creates a "Saree" product type, moves each product's fabric, weave, occasion, pattern, length and blouse-piece details into the attribute library, and turns colour variants into a Colour option with photos grouped per colour. Stock, SKUs, prices and variant ids are kept, so carts, orders and stock alerts keep working. It then rebuilds the catalogue indexes whose definition changed (search over detail values, stock alerts per variant). It is safe to re-run: only products still without a type are touched. Back up the database first.

## Catalogue at scale

The storefront is server-rendered and built for 10k–50k products per store:

- `/products`, `/shop/[type]`, `/categories/[slug]` and search share one listing (`lib/catalog/query.js`), with filters, sort and page in the URL. Product pages use indexed `find().sort().skip().limit()`, and every sort is backed by an index ending in `_id`. Filter counts come from one slim `$facet` aggregation, cached separately from paging and sorting.
- Results are cached per store and per query (`"use cache"`), and invalidated by any product, category, attribute or product type write.
- Search uses a weighted text index over names, SKUs and detail values, with a name-prefix fallback ("bana" finds Banarasi). Header autocomplete shows photos and prices.
- Variants are combinations of the type's options (Colour × Size, Colour × Waist size…), each with its own SKU, barcode and stock; photos belong to a colour. Stock is reserved atomically per variant.
- Filters: see [Product types](#product-types).
- Search engines: see [SEO](#seo).

Cart and checkout keep only `{productId, variantId, quantity}` in the browser. Prices, tiers, MOQ, stock, GST and shipping always come from the server (`POST /api/v1/cart/price`), using the same rules as order creation (`lib/catalog/pricing.js`).

## Product types

A store sells one or more **product types**. Each type says which details a product has and which options make its variants. The model follows Saleor/Shopify (product types, options, variants) with Akeneo-style shared attributes.

- **What you sell** (Admin → Store settings → What you sell, owners). Tick one type, several or all. Templates (Saree, T-shirt, Shirt, Jeans, Kurta, Dress, Footwear, Kidswear, Bags, Custom) add a ready type with its details, options and an Indian size chart. Change it any time: switching a type off hides its products from the storefront, search, sitemap, carts and checkout without deleting them, and switching it back on lists them again.
- **Product types** (Admin → Product types). Name and plural, address (`/shop/<slug>`; a renamed address redirects), icon, the details the product form asks for (each required or optional), up to three options with the values offered (Colour × Size…), a size chart (inches or cm, one primary measurement for the fit finder) and defaults (HSN code, GST rate, minimum order, care). A type with products can't be deleted, and an option value in use can't be removed.
- **Attribute library** (Admin → Attributes). One list per detail, shared by every type, so a "Cotton" filter covers sarees and shirts alike. Inputs: list, multi-list, colour (with swatch), text, number (with unit), yes/no. Renaming a value updates every product, type, size chart and home page section that uses it; a value in use can't be deleted. *Filterable* attributes become storefront filters; a schema.org mapping (material, pattern, colour, size, gender, age group) feeds structured data.
- **Product form.** Choosing a type shows its details; the variant grid builds every option combination with suggested SKUs, a barcode and stock for each, and photos per colour. A product can override its type's size chart.
- **Storefront.** The header's Shop menu lists the types (one type stays the whole catalogue). `/shop/<type>` shows that type's filters, with sizes in size order. Mixed listings offer the filters shared by at least two stocked types, and older links with other filters keep working. Option filters match on one variant: Black + M + In stock means a black M is in stock. Product pages have a picker per option with sold-out states, an address per variant (`?color=black&size=m`), a size guide with a unit switch and a fit finder, and back-in-stock alerts per variant.
- **Catalogue insights** (Admin → Catalogue insights). Per type: units sold, sales, sell-through, how long stock lasts at the current sales rate, sold-out variants and view-to-cart rate. The size curve compares each size's share of units sold with its share of stock and calls reorder or overstock at a gap of 5 points or more (from 10 units sold). Also lists variants to restock first, ranked by demand, and listed products that haven't sold.

## SEO

Built to Google Search Central's documentation; all of it lives in `lib/seo/` and runs per store.

- **Head tags.** Every page gets its metadata from `pageMetadata` (`lib/seo/metadata.ts`): title, description, an absolute canonical on the primary domain, robots rules (`max-image-preview:large` on indexable pages), and complete Open Graph and X cards (1200×630 share images cut by Cloudinary). Search and link-preview crawlers, Googlebot included, receive metadata in the initial `<head>` (`htmlLimitedBots` in `next.config.mjs`); Google reads `rel="canonical"` only there.
- **What is indexed.** Products, categories, product type listings (`/shop/<type>`), the catalogue and each of its pages (`?page=N` is its own canonical), guides and content pages. Searches, filters and sorts are `noindex` and blocked in `robots.txt`, as Google advises for faceted navigation. Carts, checkout, accounts, the admin and newsletter links are never indexed.
- **Structured data** (`lib/seo/structured-data.js`): `OnlineStore` with its return and shipping policies and `WebSite` on the home page; `Product` (or `ProductGroup` varying by colour and/or size, one URL per variant such as `?color=black&size=m`, with GTIN, material, pattern and audience from the attribute library) with offers, minimum order, strikethrough sale price, shipping, returns, ratings and reviews on product pages; `BreadcrumbList` on product, category and guide pages; `Article` on guides; `FAQPage` on the FAQ.
- **Sitemaps.** `/sitemap.xml` is an index of `pages.xml` and `products-N.xml` (2,000 products per file, with their photos and colour photos as image entries); `pages.xml` lists the product type listings; `<lastmod>` is the real time of the last change.
- **Addresses.** Product, category and guide URLs are lower case (`proxy.ts` redirects other spellings with a 308). Renaming a product's slug or a category keeps the old URL working with a permanent redirect. Pages that don't exist show the not-found page with `noindex` (a 404 status where the response hasn't started streaming).
- **Favicons.** The store's favicon is served as square PNGs (Google shows only square icons); stores without one get their initial on their brand colour (`app/[domain]/icons`).

**For each store, once it is live:**

1. Admin → Store settings → SEO: paste the Google Search Console and Bing Webmaster Tools verification codes (HTML tag method), then verify there and submit `https://<primary domain>/sitemap.xml`.
2. Admin → Store settings → Tax & shipping: check the dispatch and delivery times (search engines show them with products; the default shipping policy quotes the dispatch time).
3. Point any other domains (e.g. `www.`) at the primary domain with a permanent redirect in your host's domain settings (Vercel → Domains → Redirect to). Canonical URLs already name the primary domain; a redirect is the stronger signal.
4. Fill in the logo, social profiles and GSTIN under Store settings: they appear in the store's structured data.

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

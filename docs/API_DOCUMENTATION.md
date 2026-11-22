# Norosilk API v1 Documentation

Base URL: `{NEXT_PUBLIC_APP_URL}/api/v1`

All responses follow:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Errors:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Invalid email address" }]
}
```

Authentication uses HttpOnly cookies set by login/register/refresh. Send requests with credentials included (Postman: enable cookies, or browser fetch with `credentials: "include"`).

---

## Health

### `GET /health`

No auth. Returns API and Mongo connection state.

---

## Auth

### `POST /auth/register`

Body:

```json
{
  "name": "Wholesale Buyer",
  "email": "buyer@example.com",
  "password": "securepass123",
  "phone": "+91 98765 43210",
  "companyName": "Silk Traders LLP",
  "gstNumber": "29ABCDE1234F1Z5"
}
```

Creates a customer account. `201 Created`. Only verified email addresses get a session, so the answer is one of:

- `data.verification`: `{ email, expiresAt, resendAt, error? }`. A 6-digit code was emailed (valid 10 minutes, 5 tries) and a short-lived `norosilk_verify` cookie (HttpOnly, path `/api/v1/auth`, 30 minutes) marks this browser. Finish with `POST /auth/verify-email`. `error` is set when the email could not be sent; ask for another with `POST /auth/verify-email/resend`.
- `data.user`: signed in (auth cookies set). This happens only when the platform can't send email (`RESEND_API_KEY` / `NOTIFY_EMAIL_FROM` unset).

### `POST /auth/login`

Body: `{ "email": "...", "password": "..." }`

Same answers as register. A verified account gets `data.user` and the auth cookies. An account whose email isn't verified yet gets `data.verification`, after the password check: sessions issued earlier to such accounts are no longer accepted.

### `POST /auth/verify-email`

Body: `{ "code": "123456" }` (spaces and dashes are ignored). Needs the `norosilk_verify` cookie from register/login. The right code verifies the email, sets the auth cookies and returns `data.user`. A wrong one returns `422` with a `code` field error saying how many attempts are left. Every guess counts, and after 5 the code stops working. Limited to 10 attempts per IP address per 15 minutes.

### `POST /auth/verify-email/resend`

Needs the `norosilk_verify` cookie. Emails a new code (`data.verification`). Allowed once a minute (`429` with `Retry-After` before that) and 5 times an hour per account.

### `POST /auth/logout`

Clears auth cookies.

### `GET /auth/user`

Requires auth. Returns the current user's profile (password omitted). Replaces the former `GET /auth/me`.

### `GET /auth/user-check`

No auth required; always `200`, so signed-out visitors don't log errors. Returns:

```json
{ "authenticated": true, "user": { "id": "...", "name": "...", "email": "...", "avatarUrl": "" } }
```

It also repairs the session cookies: an expired access token is renewed from a valid refresh token, and the cookies of a revoked or expired session are cleared. The storefront calls it only when the server-rendered header reports such a session, never on a timer.

### `POST /auth/refresh`

Requires refresh cookie. Rotates access/refresh cookies.

### Expired sessions

Access tokens live 15 minutes and refresh tokens 7 days. When a request needs a signed-in customer but the access token has expired while a refresh cookie is still present, the `401` body carries `"code": "session_expired"`. Clients should call `POST /auth/refresh` once and repeat the request (`lib/api/api-client.js` does this for every call). A plain `401` without the code means the visitor is signed out.

---

## Products

### `GET /products`

Public. Query params:

| Param | Description |
| --- | --- |
| page, limit | Pagination (default 1/20, max limit 100) |
| search | Text search (name, SKU, variant SKUs, detail values, colours) |
| category | Category ObjectId |
| type | Product type ObjectId, or `none` for products not yet upgraded to a type (admin) |
| minPrice, maxPrice | Wholesale price range |
| availability | `in_stock` or `out_of_stock` |
| status | Product status (defaults to `active` for public listings) |
| sortBy | `price`, `newest`, `popularity` |
| sortOrder | `asc` or `desc` |

### `GET /products/:productId`

Public. Accepts Mongo ObjectId or product slug.

### `POST /products`

Admin auth. Create product (see validator fields in `lib/validators/product.validator.js`). `productType` is required: details (`attributes`, keyed by attribute key) and variant `options` must use the type's fields, options and offered values, in any letter case (they are stored in the attribute library's spelling). Required details are enforced when the product is listed (`status: active`). Variant SKUs are unique across the store.

Example (a T-shirt with Colour × Size variants):

```json
{
  "name": "Classic Crew Tee",
  "sku": "TEE-CREW",
  "productType": "6650a1e2b3a4c00112233440",
  "category": "665f0c1e2b3a4c0011223344",
  "attributes": { "fabric": "Cotton", "fit": "Regular", "gender": "Men" },
  "price": 799,
  "wholesalePrice": 520,
  "minimumOrderQuantity": 10,
  "bulkPricingTiers": [{ "minQuantity": 50, "pricePerUnit": 480 }],
  "variants": [
    { "options": { "color": "Black", "size": "M" }, "sku": "TEE-CREW-BLK-M", "barcode": "8901234567897", "stockQuantity": 40 },
    { "options": { "color": "Black", "size": "L" }, "sku": "TEE-CREW-BLK-L", "stockQuantity": 25 }
  ],
  "colorMedia": [{ "color": "Black", "images": [{ "url": "https://res.cloudinary.com/...", "publicId": "norosilk/stores/.../products/t-shirts/...", "alt": "Black, front" }] }],
  "status": "active"
}
```

Product stock is the sum of the variants' stock. A type without options has no variants: send the product's own `stockQuantity`.

### `PATCH /products/:productId`

Admin auth. Partial update.

### `DELETE /products/:productId`

Admin auth. Soft delete (`status: inactive`).

### `POST|PATCH /products/:productId/images`

Admin auth. Body: `{ "images": [{ "url": "https://...", "alt": "...", "isPrimary": true, "sortOrder": 0 }] }`

### `GET|PUT|DELETE /products/:productId/stock-alert`

Customer auth. Back-in-stock alert for the product, or for one variant with `?variant=<variantId>` (a size or colour that is sold out). The email links to that variant (`?color=…&size=…`).

---

## Categories

### `GET /categories`

Public. `?includeInactive=true` for admin tooling.

### `POST /categories`

Admin auth.

### `GET /categories/:categoryId`

Public.

### `PATCH /categories/:categoryId`

Admin auth.

### `DELETE /categories/:categoryId`

Admin auth. Soft deactivate.

---

## Catalogue setup (admin)

Product types, the attribute library and catalogue insights. Every write invalidates the store's catalogue cache. See README → Product types.

### Product types

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/product-types` | Types with product counts, templates, and `untypedCount` (products not yet upgraded) |
| POST | `/admin/product-types` | `{ "template": "t-shirt" }` adds a ready type (details, options, size chart; missing attributes are added to the library); or a full type body (`createProductTypeSchema` in `lib/validators/catalog-setup.validator.js`) |
| GET | `/admin/product-types/:typeId` | One type |
| PATCH | `/admin/product-types/:typeId` | Partial update. `isActive` switches the type on or off sale (its products are hidden, not deleted). Removing an option, or an option value that products use, is `409` |
| DELETE | `/admin/product-types/:typeId` | `409` while products have this type |
| PUT | `/admin/product-types/selling` | `{ "typeIds": [...], "templates": ["jeans"] }`: these types go on sale, every other type goes off. Templates are added and put on sale; one the store already has reuses that type, so repeating the request changes nothing |
| GET | `/admin/product-types/upgrade` | Owners. Dry run of the catalogue upgrade (what would change) |
| POST | `/admin/product-types/upgrade` | Owners. Upgrades products without a type to a Saree type and rebuilds the catalogue indexes (same as `npm run catalog:upgrade -- --apply`) |

Catalogue permission (owners and managers) unless noted.

### Attribute library

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/attributes` | Attributes with the types and number of products using each |
| POST | `/admin/attributes` | `{ key, name, input, unit?, values?, filterable?, visible?, schemaProperty?, helpText? }`; `key` (`a-z`, `0-9`, `_`) and `input` can't change later. Keys that clash with URL parameters (`q`, `page`, `sort`, `type`…) are refused |
| PATCH | `/admin/attributes/:attributeId` | Values are matched by `_id`: a changed label renames the value on every product, type, size chart and home page section; removing a value that products use is `409` |
| DELETE | `/admin/attributes/:attributeId` | `409` while a type or product uses it |
| POST | `/admin/attributes/:attributeId/values` | `{ label, hex? }`: adds one value (from the product form); returns the stored spelling, or the existing one when it differs only in letter case |

### `GET /admin/insights/catalog`

Catalogue permission. `?days=` (7–365, default 30) and optional `?type=<typeId>`. Returns `summary` (units sold, sales, sell-through, stock and its value, sold-out variants), `byType` (the same per type, plus weeks of cover and view-to-cart rate), `sizeCurves` (per size: share of units sold vs share of stock, gap in points and a reorder/overstock call once 10+ units sold), `restock` (variants with stock below the minimum order, which can't be bought, or at or below the low-stock alert; ranked by units sold, then views) and `deadStock` (products listed before the period, with stock and no sale in it, most money tied up first).

---

## Orders

### `GET /orders`

Auth required. Customers see own orders; admins see all. Supports pagination and `?status=pending`.

### `POST /orders`

Auth required. Server calculates pricing and inventory.

Body:

```json
{
  "items": [{ "productId": "...", "quantity": 20, "selectedAttributes": { "color": "Ivory" } }],
  "shippingAddress": {
    "fullName": "Buyer Name",
    "phone": "+919876543210",
    "addressLine1": "12 Market Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001",
    "country": "India"
  },
  "paymentMethod": "bank_transfer",
  "notes": "Need dispatch before festival season"
}
```

### `GET /orders/:orderId`

Auth required (owner or admin).

### `PATCH /orders/:orderId/status`

Admin auth. Body: `{ "orderStatus": "confirmed", "paymentStatus": "paid" }`

---

## Customers

Admin auth only.

- `GET /customers` — paginated list, `?search=`
- `GET /customers/:customerId`
- `PATCH /customers/:customerId` — update profile flags/contact/company fields

---

## Cart

Auth required.

- `GET /cart`
- `POST /cart` — body `{ "productId", "quantity", "selectedAttributes" }`
- `PATCH /cart` — upsert item
- `DELETE /cart?productId=` — remove item
- `DELETE /cart` — clear cart

---

## Wishlist

Auth required.

- `GET /wishlist`
- `POST /wishlist` — `{ "productId": "..." }`
- `DELETE /wishlist?productId=`

---

## Upload

### `POST /upload`

Admin auth. `multipart/form-data`: `files` (one or more images), optional `folder`, `productType` (type slug: photos go to `products/<slug>`) or `fabric` (older clients). Requires Cloudinary env vars. Returns `{ images: [{ url, publicId, width, height, ... }] }`. See `docs/CLOUDINARY_SETUP.md`.

---

## Postman quick start

1. Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
2. Create an admin MongoDB user (see `scripts/create-admin-user.mjs`).
3. `POST /api/v1/auth/login` with admin credentials — cookies are stored automatically when using Postman cookie jar.
4. Call admin endpoints (`POST /products`, etc.) without manually setting Authorization headers.

---

## Environment variables

See `.env.example` for MongoDB, JWT, tax/shipping, and Cloudinary settings.

## Remaining integration tasks

- Connect storefront product pages to `/api/v1/products` instead of static `data/products.ts`.
- Replace guest checkout simulation with authenticated order placement.
- Promote contact messages to MongoDB if unified inbox is required.
- Rate limits are stored in MongoDB (`lib/security/rate-limit.js`); move to Redis if request volume makes that a bottleneck.

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

Creates a customer account, sets auth cookies. `201 Created`.

### `POST /auth/login`

Body: `{ "email": "...", "password": "..." }`

### `POST /auth/logout`

Clears auth cookies.

### `GET /auth/me`

Requires auth. Returns current user profile (password omitted).

### `POST /auth/refresh`

Requires refresh cookie. Rotates access/refresh cookies.

---

## Products

### `GET /products`

Public. Query params:

| Param | Description |
| --- | --- |
| page, limit | Pagination (default 1/20, max limit 100) |
| search | Text search (name, SKU) |
| category | Category ObjectId |
| fabric, weavingType | Exact match filters |
| minPrice, maxPrice | Wholesale price range |
| availability | `in_stock` or `out_of_stock` |
| status | Product status (defaults to `active` for public listings) |
| sortBy | `price`, `newest`, `popularity` |
| sortOrder | `asc` or `desc` |

### `GET /products/:productId`

Public. Accepts Mongo ObjectId or product slug.

### `POST /products`

Admin auth. Create product (see validator fields in `lib/validators/product.validator.js`).

Example:

```json
{
  "name": "Aurora Silk 44",
  "sku": "NS-AUR-44",
  "category": "665f0c1e2b3a4c0011223344",
  "price": 5200,
  "wholesalePrice": 4300,
  "minimumOrderQuantity": 10,
  "stockQuantity": 250,
  "bulkPricingTiers": [{ "minQuantity": 50, "pricePerUnit": 4100 }],
  "status": "active"
}
```

### `PATCH /products/:productId`

Admin auth. Partial update.

### `DELETE /products/:productId`

Admin auth. Soft delete (`status: inactive`).

### `POST|PATCH /products/:productId/images`

Admin auth. Body: `{ "images": [{ "url": "https://...", "alt": "...", "isPrimary": true, "sortOrder": 0 }] }`

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

Admin auth. `multipart/form-data` field `file`. Requires Cloudinary env vars. Returns `{ url, publicId, ... }`.

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

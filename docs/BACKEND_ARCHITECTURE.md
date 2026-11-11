# Norosilk Backend Architecture

## Overview

Norosilk uses a modular JavaScript backend inside the existing Next.js App Router project. Storefront and admin UI remain TypeScript/React. New REST APIs live under `/api/v1/*` and use MongoDB through Mongoose.

## Request flow

```text
Route Handler (app/api/v1)
  -> withDatabase / withApiHandler
  -> auth + rate limiting (where required)
  -> Zod validation (validators/)
  -> service layer (lib/services)
  -> repository or model (lib/repositories, lib/db/models)
  -> MongoDB Atlas
  -> standardized JSON response (lib/utils/api-response.js)
```

## Layers

| Layer | Responsibility |
| --- | --- |
| Route handlers | HTTP method routing, status codes, cookie side effects via services |
| Middleware | JWT cookie auth, admin authorization, rate limiting |
| Validators | Zod schemas and field-level error mapping |
| Services | Business rules (MOQ, wholesale tiers, order totals, inventory transactions) |
| Repositories | Reusable query composition |
| Models | Mongoose schemas, indexes, enums |

## Authentication model

- Customer/admin accounts are stored in MongoDB (`User` model).
- `/api/v1/auth/*` issues HttpOnly cookies (`norosilk_access`, `norosilk_refresh`) signed with `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Existing `/admin` dashboard login remains env-based (`AUTH_SECRET`, `ADMIN_EMAIL`) and is unchanged.
- Admin APIs under `/api/v1` require the admin session (`/admin/login`) of an active `role: "admin"` user. Storefront tokens belong to customers only: staff accounts can't sign in on the storefront, and a token stops working if its account becomes staff.
- Only verified email addresses get a storefront session (`isUsableCustomer` in `lib/auth/session.js`). Sign-up, and the sign-in of an unverified account, email a 6-digit code (`lib/services/email-verification.service.js`), and the session opens once it is entered. The same codes confirm a change of email. Codes are stored as an HMAC (keyed with `JWT_SECRET`), are valid for 10 minutes, are single-use, and allow 5 attempts, each counted before it is compared. The rule is skipped when the platform can't send email.
- Customers can reset a forgotten password with a single-use emailed link (`/account/forgot-password`, 30 minutes); resetting ends every other session and marks the email verified.
- Links in emails (password reset, quotes, notifications, newsletter) use the store domain the request came in on (`getStoreOrigin` in `lib/tenant/active.js`). A host is only used after it has resolved to the store, so a forged `Host` header never reaches a link. Development hosts (`localhost`, `*.localhost`, IP addresses) keep their port and use http. Jobs without a request use the store's primary domain, its first `domains` entry. Canonical URLs, the sitemap and invoices always use the primary domain, so list the production domain first.

## Persistence

- Primary database: MongoDB Atlas via `MONGODB_URI`.
- Contact form messages are stored as support conversations in MongoDB via `POST /api/v1/contact`.
- Product images store metadata in MongoDB; binaries upload to Cloudinary when configured.

## Wholesale order rules

- Unit price is resolved server-side (`resolveUnitPrice`) using MOQ, wholesale price, and optional bulk tiers.
- Totals ignore client-submitted prices.
- Tax and shipping are store settings (`StoreSettings.commerce`): GST per product (or the store default) plus a flat shipping charge with an optional free-shipping threshold. See `lib/services/order-pricing.js`.
- Order creation uses a MongoDB transaction to decrement inventory and insert the order atomically (requires a replica set, available on Atlas).

## Security practices

- Passwords hashed with bcrypt (cost 12).
- JWT secrets never exposed to the client.
- Mongo filters sanitized against operator injection.
- Rate limiting for login, register, contact, uploads, and payments (MongoDB-backed, shared across instances; in-memory fallback).
- Errors return safe messages without stack traces.

## Frontend integration status

The storefront still reads the static catalog in `data/products.ts`. Wire product listing and checkout UI to `/api/v1` incrementally without breaking current pages.

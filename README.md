# Norosilk

Norosilk is a wholesale saree storefront and admin dashboard built with the Next.js App Router (Next.js 16, React 19), MongoDB/Mongoose, Razorpay payments, Cloudinary images, and Delhivery shipping.

## Getting started

```bash
cp .env.example .env.local   # then fill in the values you need
npm install
npm run dev
```

Requires Node.js 20.19 or newer (see `.nvmrc`).

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run check` | Lint, typecheck, and unit tests (what CI runs, plus `build`) |
| `npm run test:integration` | MongoDB integration tests (needs `MONGODB_URI_TEST`) |
| `npm run format` | Format the codebase with Prettier |
| `npm run seed:catalog` | Seed the product catalog |
| `npm run import:legacy-contacts` | One-off import of the retired `.data/contact-messages.json` store into the support inbox |

Server configuration is validated at startup (`lib/env.js`, called from `instrumentation.ts`). Missing core secrets or half-configured integrations stop a production server from booting; in development they are logged as warnings.

Without `MONGODB_URI` the storefront falls back to the static demo catalog in `data/products.ts`; orders, accounts, payments, and the admin dashboard need MongoDB.

## Project layout

- `app/` — routes. `(storefront)` is the public shop, `admin/(protected)` the dashboard, `api/v1` the JSON API.
- `components/` — UI shared across routes; `components/ui` holds primitives.
- `features/` — client-side domain modules (cart, checkout, orders, products, reviews).
- `hooks/` — shared React hooks.
- `lib/` — server code:
  - `auth/` — customer JWT sessions (`session.js`) and admin guards (`admin-access.js`)
  - `admin/` — dashboard admin sign-in (separate signed cookie)
  - `services/` — business logic; `repositories/` — query helpers; `db/models/` — Mongoose models
  - `validators/` — Zod schemas; `security/` — rate limiting and client IP; `utils/` — shared helpers
- `docs/` — feature and API documentation.

File names are kebab-case, except Mongoose models (`lib/db/models/PascalCase.js`).

## API conventions

All endpoints live under `/api/v1` and are wrapped in `withApiHandler` / `withDatabase`, which return a consistent shape:

```json
{ "success": true, "message": "…", "data": {}, "meta": {} }
{ "success": false, "message": "…", "errors": [{ "field": "email", "message": "…" }], "requestId": "…" }
```

Throw `ApiError(status, message, errors)` from services. Mongoose `CastError`, `ValidationError`, and duplicate-key errors are mapped to 400/422/409 automatically; anything else becomes a logged 500 with a `requestId` (also sent as the `x-request-id` header) to correlate with server logs.

Every admin route handler must call `requireAdminAccess()` (or `requireAdminUser()`) itself — layout protection alone is not enough.

## Admin access

Two sign-in paths exist:

1. **Database admins (recommended):** `node scripts/create-admin-user.mjs <email> <password> [name]`.
2. **Environment bootstrap:** `ADMIN_EMAIL` plus `ADMIN_PASSWORD_HASH` (generate with `node scripts/hash-admin-password.mjs`; bcrypt cost ≥ 12). `ADMIN_PASSWORD` (plaintext) is accepted only outside production.

`AUTH_SECRET` signs the dashboard session (eight hours, HttpOnly, SameSite=Strict, Secure in production).

## Rate limiting

Login, registration, contact, upload, and payment endpoints are rate limited per client IP. Buckets are stored in MongoDB (`ratelimits` collection with a TTL index) so limits hold across server instances, falling back to process memory when the database is unavailable. The client IP comes from `X-Real-IP` / `X-Forwarded-For`, so the hosting proxy must overwrite those headers.

## Contact inquiries

The `/contact` form posts to `POST /api/v1/contact`. Submissions are validated with Zod (including a honeypot field), rate limited, and stored as support conversations in MongoDB; they appear in `/admin/messages`. If `RESEND_API_KEY` and `NOTIFY_EMAIL_TO` are set, a notification email is sent after the response.

Set `NEXT_PUBLIC_BUSINESS_EMAIL`, `NEXT_PUBLIC_BUSINESS_PHONE`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, and `NEXT_PUBLIC_BUSINESS_HOURS` to publish contact cards and the embedded map; leave them empty to show setup placeholders.

## Security headers

`next.config.mjs` sets a Content-Security-Policy, HSTS, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` on every response. When adding a new third-party script, image host, or iframe, add its origin to the CSP there.

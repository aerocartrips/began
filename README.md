# NeoVastra

NeoVastra is a Next.js App Router storefront prototype for wholesale saree batches.

## Development

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Routes

- `/` - brand landing page
- `/products` - product catalog
- `/products/[slug]` - product details and purchase actions
- `/cart` - persisted guest cart
- `/checkout` - cart checkout review
- `/checkout?intent=buy-now` - checkout for the selected item only
- `/contact` - contact details, map, and inquiry form
- `/admin/login` - administrator sign-in
- `/admin` - protected store overview
- `/admin/orders`, `/admin/products`, `/admin/payments`, `/admin/messages`, `/admin/customers`, `/admin/settings` - protected admin sections

## Architecture

- `app/` owns routes, metadata, loading boundaries, and the root layout.
- `components/layout/` contains the global site shell.
- `components/ui/` contains reusable interface primitives.
- `components/marketplace/` contains reusable product and purchase UI.
- `features/cart/` owns cart types, reducer, persistence, provider, and cart views.
- `features/checkout/` owns checkout presentation and purchase-intent selection.
- `features/products/` owns the product model; `data/products.ts` is the current static catalog.

The guest cart stores product IDs, quantities, and selected option IDs in `localStorage`; current names and prices are derived from the catalog. Buy Now uses a separate `sessionStorage` intent and does not add the product to or check out unrelated cart items.

## Checkout Integration Boundary

There is no order API, inventory service, customer authentication system, or payment provider in this project. Checkout currently validates browser form fields and clearly reports that it did not submit an order or collect payment. Shipping and taxes are supplier-confirmed and are not fabricated in totals. Do not treat client-side cart prices or inventory as authoritative.

Before accepting orders, implement a server-side order endpoint that re-reads product prices and stock, validates variants and quantities, calculates shipping/tax, and uses an idempotency key. Integrate a payment provider through its secure server flow, verify provider callbacks, and only then clear/reconcile the cart and show an order confirmation.

## Admin Access

Copy `.env.example` to `.env.local`. Generate a bcrypt hash using the masked prompt (the password is not echoed or written to shell history):

```bash
node scripts/hash-admin-password.mjs
```

Generate a signing secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

For local development, copy `.env.example` to `.env.local` and set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a unique `AUTH_SECRET` of at least 32 bytes, then restart the Next.js server. Plaintext passwords are accepted only outside production. Production requires `ADMIN_PASSWORD_HASH`; generate it with the script above (12-character minimum, bcrypt cost 12), and do not configure `ADMIN_PASSWORD`. Admin sessions are signed, expire after eight hours, and use an HttpOnly, SameSite=Strict cookie (Secure in production). Login errors are generic.

Login throttling is in-memory and per-process, suitable only for a single-instance prototype. It uses `X-Real-IP` for the address bucket, so production ingress must overwrite that header and the application origin must not be directly exposed; use a shared rate-limit store before deploying multiple instances. Product create/edit/delete works in browser memory and is reset on refresh; image selections are local previews only. No database, order/payment service, or image storage is configured for catalog or checkout.

## Contact inquiries

The `/contact` form posts to `POST /api/contact`, validates on the client and server, applies a honeypot and per-IP rate limit, and persists messages to a JSON file (default `.data/contact-messages.json`, override with `CONTACT_MESSAGES_FILE`). Submissions appear in `/admin/messages`. Set `NEXT_PUBLIC_BUSINESS_EMAIL`, `NEXT_PUBLIC_BUSINESS_PHONE`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, and `NEXT_PUBLIC_BUSINESS_HOURS` in `.env.local` to publish contact cards and the embedded map; leave them empty to show setup placeholders instead of invented details. Email notifications are not configured; add a provider server-side after persistence if needed.

The admin session is separate from customer authentication. Every admin page checks the signed session on the server. Any future admin Server Action, Route Handler, or mutation must repeat the authorization check inside the operation; layout protection alone is not sufficient.

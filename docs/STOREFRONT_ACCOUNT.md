# Storefront account & customer experience

## Account navigation

- Header account menu (`CustomerAccountMenu`) — sign in / register or dropdown with My Orders, My Reviews, Support, logout.
- Footer **Account** and **Support** columns link to `/account/orders`, `/account/reviews`, `/shipping`, `/returns`, and `/contact`.

## Pages

| Route | Purpose |
|-------|---------|
| `/account/orders` | Order list, filters, load more, reviews on delivered orders, invoice download |
| `/account/orders/[orderId]` | Timeline, tracking, cancel/return, per-product reviews, invoice |
| `/account/reviews` | Customer review history with filters and edit/delete |
| `/account/support` | Support chat with the Norosilk team (see `SUPPORT_MESSAGES.md`) |
| `/shipping` | Shipping information |
| `/returns` | Returns & refund policy overview |

## Invoices

- `GET /api/v1/orders/:orderId/invoice` — PDF download (customer owner or admin).
- Invoice metadata stored on `Order.invoice` (`number`, `issuedAt`).
- Amounts use order snapshots only. Set `BUSINESS_GSTIN` for GST line on PDF.

## Search

- Header `StorefrontSearch` — debounced suggestions; Mongo catalog uses `GET /api/v1/products?search=`.
- Static fallback catalog filters client-side.
- Full results: `/products?search=...`

## Cancellation refunds

Paid pre-shipment cancellations call Razorpay refund API when configured. Status tracked on `Order.cancellationRefund` and reconciled via payment webhooks. UI never marks refund complete without backend confirmation.

## Catalog reviews

- MongoDB products include `ratingSummary` on catalog map for cards.
- Static demo products show no fake stars; detail shows “Be the first to review” when count is zero.

## Account management

Pages live in the `app/(storefront)/account/(dashboard)` route group, which adds the shared sidebar and session check without changing URLs: `/account`, `/account/profile`, `/account/addresses`, `/account/security`, `/account/preferences`, `/account/settings` (plus orders, reviews, support). `/account/verify-email` sits outside the group because it works signed out.

| Endpoint | Purpose |
|----------|---------|
| `GET/PATCH /api/v1/account/profile` | Profile (first/last name, phone, business name, GSTIN). `name` is derived. |
| `PUT/DELETE /api/v1/account/profile/avatar` | Profile photo (Cloudinary, 5 MB) |
| `POST/DELETE /api/v1/account/email`, `POST /api/v1/account/email/verify` | Email verification or change, via a single-use link valid for 1 hour (needs `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`) |
| `GET/POST /api/v1/account/addresses`, `PUT/DELETE /api/v1/account/addresses/:id`, `POST .../:id/default` | Address book (max 10) with separate shipping/billing defaults |
| `GET/PATCH /api/v1/account/preferences` | Order, shipping and promotional email preferences (promotional is opt-in and timestamped) |
| `POST /api/v1/account/password`, `GET /api/v1/account/security` | Password change (signs out other devices) and security activity |
| `POST /api/v1/auth/logout-all` | Revoke every session |
| `GET /api/v1/account/export` | JSON download of personal data |
| `GET/POST/DELETE /api/v1/account/deletion-request` | Request or cancel account deletion (password + typed `DELETE`) |
| `POST /api/v1/customers/:id/anonymize` | Admin: complete a pending deletion once no orders, returns or refunds are open |

- Addresses are embedded in `User.addresses`. Defaults are the `defaultShippingAddressId`/`defaultBillingAddressId` pointers, and every write is a single atomic document update, so the address limit and default reassignment stay safe under concurrent requests.
- Session revocation: tokens carry `sv` (the session version). Incrementing `User.sessionVersion` invalidates all access and refresh tokens. Tokens issued before this change map to version 0.
- Checkout accepts `shippingAddressId`/`billingAddressId`. Ids are looked up only within the signed-in customer's address book and revalidated before being copied onto the order. Billing snapshots also freeze `companyName`/`gstin`, so invoices don't change after profile edits; older orders fall back to the profile.
- Anonymization scrubs the profile, addresses, cart and wishlist and disables sign-in. Orders, payments and invoices keep their snapshots for legal retention.

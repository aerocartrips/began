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

# Order Management

Norosilk separates **payment status** from **fulfillment (order) status**.

## Lifecycle

Normal fulfillment flow:

`pending_payment → confirmed → processing → packed → shipped → out_for_delivery → delivered`

Exception states:

- `cancelled`
- `return_requested`
- `returned`

Payment statuses:

- `pending`, `paid`, `failed`, `refunded`, `partially_refunded`

Paid capture (Razorpay verify/webhook) sets `paymentStatus=paid` and `orderStatus=confirmed`, and numbers the invoice (see below).

## Customer view and windows

Customer responses are built from an allow-list (`lib/services/order-dto.js`): internal notes, staff remarks and who made each change never leave the server; admins get the full order. Each order carries `actions` computed from the store's windows (Admin → Store settings → Orders, `lib/services/order-policy.js`), which the API also enforces:

- unpaid orders can be cancelled until payment;
- paid orders within `cancellationWindowHours` of being placed, before dispatch;
- returns within `returnWindowDays` of delivery (`deliveredAt`).

## Invoices

Invoice numbers are `PREFIX/FY/SERIAL` (e.g. `INV/26-27/00042`): consecutive per store and Indian financial year, at most 16 characters (GST rule 46), allocated in the payment's transaction from the `Counter` collection. Only paid (or later refunded) orders have an invoice. Paid orders from before this scheme get the next number on first download.

## Customer APIs

| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/v1/orders/summary` | Customer JWT or admin dashboard |
| GET | `/api/v1/orders` | Customer JWT (own orders) or admin dashboard (all) |
| GET | `/api/v1/orders/:orderId` | Owner or admin |
| POST | `/api/v1/orders/:orderId/cancel` | Owner |
| POST | `/api/v1/orders/:orderId/return-request` | Owner (delivered only) |
| POST | `/api/v1/orders/:orderId/refresh-payment` | Owner |
| GET | `/api/v1/orders/:orderId/tracking` | Owner or admin |

Query params for listing:

- `page`, `limit`, `bucket`, `orderStatus`, `paymentStatus`, `q`, `dateFrom`, `dateTo`, `sort`

## Admin APIs

| Method | Route | Auth |
|--------|-------|------|
| PATCH | `/api/v1/orders/:orderId/status` | Commerce admin (admin session) |

Admin payload supports:

- `orderStatus`, `paymentStatus`
- `internalNotes`, `customerVisibleRemark`, `remarks`
- `shipmentAwb`, `shipmentStatus`

Status changes append to `order.statusHistory` with actor, source, and timestamps. Cancelling (`orderStatus: "cancelled"`) returns the stock and refunds a paid order in full; `paymentStatus` can only be set from `pending` to `paid` (an offline payment). The admin form offers only the moves the server accepts.

## Transition rules

Server-side validation lives in `lib/constants/order-transitions.js` and `lib/services/order-status.service.js`.

- Unpaid orders cannot move into shipped/delivered fulfillment states.
- Terminal states (`cancelled`, `returned`) cannot resume normal fulfillment without explicit allowed transitions.
- Customers cannot PATCH status directly.

## Delhivery tracking

Configure:

The API token is per store (`npm run tenant:integrations`); the endpoint and cache are platform env:

```env
DELHIVERY_API_BASE_URL=https://track.delhivery.com
DELHIVERY_TRACKING_CACHE_MS=300000
```

Tracking is fetched **server-side** via `GET /api/v1/orders/:orderId/tracking`.

- Credentials never reach the browser.
- Responses are cached on the order shipment for five minutes by default.
- If Delhivery is not configured, the API returns a safe unavailable message.

There is **no automatic shipment creation** in this release—admins assign AWB through the admin order detail form.

## Storefront pages

- `/account/orders`
- `/account/orders/[orderId]`
- `/admin/orders`
- `/admin/orders/[orderId]`

## Tests

```bash
npm run test -- tests/unit/order-management.test.js
```

## Notes

- Line items store price/name/image snapshots at order time.
- Refunds remain Razorpay-admin flows; cancellation does not imply refund success.
- Live Delhivery/Razorpay calls require credentials in `.env.local`.

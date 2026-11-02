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

Paid capture (Razorpay verify/webhook) sets `paymentStatus=paid` and `orderStatus=confirmed`.

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
| PATCH | `/api/v1/orders/:orderId/status` | Commerce admin (dashboard cookie or Mongo admin JWT) |

Admin payload supports:

- `orderStatus`, `paymentStatus`
- `internalNotes`, `customerVisibleRemark`, `remarks`
- `shipmentAwb`, `shipmentStatus`

Status changes append to `order.statusHistory` with actor, source, and timestamps.

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

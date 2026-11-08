# Razorpay Payments

## Configuration (per store)

Each store has its own Razorpay account. Store the keys on the store (encrypted with `TENANT_SECRETS_KEY`):

```bash
RAZORPAY_KEY_ID=rzp_test_... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=... npm run tenant:integrations -- --tenant <slug>
```

In the Razorpay dashboard, point the store's webhook at `https://<store domain>/api/v1/payments/webhook`; the request's domain selects the store whose secret verifies the signature. All prices are INR. The payment reservation window is a store setting (Admin → Store settings → Orders). Secrets are never sent to the browser.

## Flow

1. Authenticated customer submits checkout → `POST /api/v1/payments/create-order` (the only way orders are created)
2. Server creates internal order (`pending_payment`), reserves inventory, creates Razorpay order + `Payment` record. Paying again for the same cart, prices and addresses resumes that order and its Razorpay order (`Order.checkoutSignature`) instead of reserving the stock twice. If Razorpay cannot create the order, the internal order is cancelled at once and its stock released.
3. Frontend opens Razorpay Standard Checkout
4. Customer pays → `POST /api/v1/payments/verify` with signature
5. Server verifies HMAC, fetches authoritative payment status from Razorpay, marks order paid only when `captured`
6. Razorpay webhooks reconcile missed/delayed frontend verification through `POST /api/v1/payments/webhook`

## Webhook setup

Configure Razorpay Dashboard webhook URL:

`https://your-domain.com/api/v1/payments/webhook`

Enable events:

- `payment.captured`
- `payment.failed`
- `order.paid`
- `refund.created`
- `refund.processed`
- `refund.failed`

The handler verifies `X-Razorpay-Signature` against the raw request body.

## Admin

- `GET /api/v1/payments` lists payment records (admin session)
- `POST /api/v1/payments/refunds` initiates full/partial refunds (admin session, `payments:refund`)
- Order page: marking an unpaid order **paid** records an offline payment (the only manual payment change); refunds go through the refund action.

## Inventory reservation

All order, payment and stock transitions live in `lib/services/order-lifecycle.service.js`; stock moves only through `lib/services/inventory.service.js`, which records every change in the `StockMovement` ledger.

- Stock is reserved when the order enters `pending_payment` and stays held by the order (`inventoryReserved`) through payment and fulfilment, until it is cancelled before dispatch.
- A failed attempt (`payment.failed`) only marks the `Payment`: Razorpay lets the shopper retry on the same order, so the order keeps its stock until the reservation window ends. The `payment-expiry` job then cancels unpaid orders and releases their stock.
- A payment that arrives after the order expired reinstates the order if its stock can still be held; if the stock was sold, or a person (customer or store) had cancelled the order, the order stays cancelled and the full amount is refunded automatically.
- Cancelling a paid order (customer within the cancellation window, or the store) returns its stock and starts a full refund.

## MongoDB transactions

Every lifecycle transition reads and writes the order inside a MongoDB transaction (`lib/db/transaction.js`, retried on write conflicts), so a webhook racing the verify call or the expiry job settles the order once. Requires a replica set (Atlas).

## Example verify request

```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature"
}
```

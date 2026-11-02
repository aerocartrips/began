# Razorpay Payments

## Configuration (per store)

Each store has its own Razorpay account. Store the keys on the store (encrypted with `TENANT_SECRETS_KEY`):

```bash
RAZORPAY_KEY_ID=rzp_test_... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=... npm run tenant:integrations -- --tenant <slug>
```

In the Razorpay dashboard, point the store's webhook at `https://<store domain>/api/v1/payments/webhook`; the request's domain selects the store whose secret verifies the signature. All prices are INR. The payment reservation window is a store setting (Admin → Store settings → Orders). Secrets are never sent to the browser.

## Flow

1. Authenticated customer submits checkout → `POST /api/v1/payments/create-order`
2. Server creates internal order (`pending_payment`), reserves inventory, creates Razorpay order + `Payment` record
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

- `GET /api/v1/payments` lists payment records (dashboard admin cookie or Mongo admin JWT)
- `POST /api/v1/payments/refunds` initiates full/partial refunds (Mongo admin JWT)

## Inventory reservation

Stock is reserved when the internal order enters `pending_payment`. Failed payments release inventory. Reservation expires after the store's payment reservation window; the `payment-expiry` cron job releases expired reservations for every store.

## MongoDB transactions

Order creation and inventory reservation use MongoDB transactions (requires Atlas replica set).

## Example verify request

```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature"
}
```

# Razorpay Payments

## Environment

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
CHECKOUT_CURRENCY=INR
PAYMENT_RESERVATION_MINUTES=30
```

Use live keys only in production. Never expose `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` to the browser.

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

Stock is reserved when the internal order enters `pending_payment`. Failed payments release inventory. Reservation expires after `PAYMENT_RESERVATION_MINUTES` (documented; cleanup job can be added separately).

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

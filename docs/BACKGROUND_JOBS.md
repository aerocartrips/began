# Background jobs

- **Job:** `payment_expiry` in `lib/jobs/payment-expiry.job.js`
- **Cron:** `GET /api/cron/payment-expiry` with `Authorization: Bearer $CRON_SECRET`
- **Manual:** `POST /api/v1/admin/jobs/payment-expiry` (commerce admin)
- **Monitoring:** `/admin/jobs`, `GET /api/v1/admin/jobs`
- **History:** `JobRun` collection

Before expiring pending payment orders, the job reconciles Razorpay via `reconcileOrderPayment`, then calls `markOrderPaymentFailed` once (`paymentExpiryProcessedAt` lock).

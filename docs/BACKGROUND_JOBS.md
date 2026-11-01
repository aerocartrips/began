# Background jobs

- **Job:** `payment_expiry` in `lib/jobs/payment-expiry.job.js`
- **Cron:** `GET /api/cron/payment-expiry` with `Authorization: Bearer $CRON_SECRET`
- **Manual:** `POST /api/v1/admin/jobs/payment-expiry` (commerce admin)
- **Monitoring:** `/admin/jobs`, `GET /api/v1/admin/jobs`
- **History:** `JobRun` collection

Before expiring pending payment orders, the job reconciles Razorpay via `reconcileOrderPayment`, then calls `markOrderPaymentFailed` once (`paymentExpiryProcessedAt` lock).

A run with failures raises a critical admin notification (`job_failed`).

## Support unanswered alerts

- **Job:** `support_unanswered_alerts` in `lib/jobs/support-alerts.job.js`
- **Cron:** `GET /api/cron/support-alerts` with `Authorization: Bearer $CRON_SECRET` (suggested: hourly)
- Alerts support admins once per customer message left unanswered for `SUPPORT_UNANSWERED_ALERT_HOURS` (default 12). Re-runs are idempotent.

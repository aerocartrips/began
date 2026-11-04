# Background jobs

- **Job:** `payment_expiry` in `lib/jobs/payment-expiry.job.js`
- **Cron:** `GET /api/cron/payment-expiry` with `Authorization: Bearer $CRON_SECRET`
- **Manual:** `POST /api/v1/admin/jobs/payment-expiry` (commerce admin)
- **Monitoring:** `/admin/jobs`, `GET /api/v1/admin/jobs`
- **History:** `JobRun` collection

Before expiring pending payment orders, the job reconciles Razorpay via `reconcileOrderPayment`, then calls `markOrderPaymentFailed` once (`paymentExpiryProcessedAt` lock).

A run with failures raises a critical admin notification (`job_failed`).

## Product metrics (best sellers, popularity, trending)

- **Job:** `product_metrics` in `lib/jobs/product-metrics.job.js`
- **Cron:** `GET /api/cron/product-metrics` with `Authorization: Bearer $CRON_SECRET` (suggested: hourly; daily works too)
- **Manual:** `POST /api/v1/admin/jobs/product-metrics` (Admin → Jobs → Run now; needs `jobs:run`)
- Recomputes `salesCount` (paid, non-cancelled orders in 90 days), `popularityScore` (views, wishlist adds, add-to-carts and orders over 60 days, halving every 14 days) and `trendingScore` (last 7 days against the product's own earlier average; 0 below the minimum activity) for every product, per store.
- **Safe to repeat:** results are recomputed from source data each time, so extra or overlapping runs change nothing. A per-store lock (`JobRun.lockKey`, unique while set) makes a concurrent run return `skipped`; a lock older than 15 minutes is treated as a crashed run and released.
- Until it first runs, "Best sellers" and "Trending" stay hidden and "Popular" falls back to newest first.

### Scheduling on Vercel

Vercel Cron calls `GET` with `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in the project's environment variables, which is exactly what these routes check. Add to `vercel.json` at the repository root:

```json
{
  "crons": [
    { "path": "/api/cron/product-metrics", "schedule": "0 * * * *" },
    { "path": "/api/cron/payment-expiry", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/support-alerts", "schedule": "0 * * * *" }
  ]
}
```

On the Hobby plan, cron jobs may run at most once a day: use `"30 21 * * *"` (03:00 IST) for product metrics, and an external scheduler for payment expiry. Cron requests go to the production deployment's own domain; the route iterates every active store itself.

## Support unanswered alerts

- **Job:** `support_unanswered_alerts` in `lib/jobs/support-alerts.job.js`
- **Cron:** `GET /api/cron/support-alerts` with `Authorization: Bearer $CRON_SECRET` (suggested: hourly)
- Alerts support admins once per customer message left unanswered for `SUPPORT_UNANSWERED_ALERT_HOURS` (default 12). Re-runs are idempotent.

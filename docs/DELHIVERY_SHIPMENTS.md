# Delhivery shipments

- **Tracking:** existing `lib/delhivery/tracking.js` + `DELHIVERY_API_TOKEN`
- **B2B booking:** `lib/delhivery/b2b-config.js`, `b2b-client.js`, `lib/services/shipment.service.js`
- **API:** `POST /api/v1/admin/orders/[orderId]/shipment` with `?action=book|manifest|reconcile|refresh-tracking`
- **Order fields:** `shipment.bookingStatus`, `bookingAttempts`, AWB/LR, manifest status

Configure `DELHIVERY_B2B_USERNAME`, `DELHIVERY_B2B_PASSWORD`, and **`DELHIVERY_B2B_BOOKING_PATH`** (and manifest path) from official Delhivery B2B/LTL documentation. Payload mapping uses server-side order snapshots and `StoreSettings.shipping`; booking is idempotent via Mongo lock on `bookingStatus` + `bookingLockedAt`.

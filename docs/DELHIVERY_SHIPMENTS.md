# Delhivery shipments

- **Tracking:** `lib/delhivery/tracking.js` with the store's Delhivery API token
- **B2B booking:** `lib/delhivery/b2b-config.js`, `b2b-client.js`, `lib/services/shipment.service.js`
- **API:** `POST /api/v1/admin/orders/[orderId]/shipment` with `?action=book|manifest|reconcile|refresh-tracking`
- **Order fields:** `shipment.bookingStatus`, `bookingAttempts`, AWB/LR, manifest status

Each store has its own Delhivery credentials: set them with `DELHIVERY_API_TOKEN=… DELHIVERY_B2B_USERNAME=… DELHIVERY_B2B_PASSWORD=… npm run tenant:integrations -- --tenant <slug>`. The API endpoints and **`DELHIVERY_B2B_BOOKING_PATH`** (and manifest path) are platform env settings from the official Delhivery B2B/LTL documentation. Payload mapping uses server-side order snapshots and `StoreSettings.shipping`; booking is idempotent via Mongo lock on `bookingStatus` + `bookingLockedAt`.

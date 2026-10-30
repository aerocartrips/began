# Returns and cancellations

- **Model:** `ServiceRequest` with audit `statusHistory`
- **UI:** `/admin/returns`, `/admin/returns/[requestId]`
- **API:** `GET /api/v1/admin/service-requests`, `GET/PATCH /api/v1/admin/service-requests/[requestId]`
- **Sync:** customer cancel/return flows in `order-actions.service.js` create service requests
- **Refunds:** `initiateRefund: true` on PATCH reuses `createAdminRefund` (Razorpay), no duplicate pending refunds

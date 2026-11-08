# Returns and cancellations

- **Model:** `ServiceRequest` with audit `statusHistory`
- **UI:** `/admin/returns`, `/admin/returns/[requestId]`
- **API:** `GET /api/v1/admin/service-requests`, `GET/PATCH /api/v1/admin/service-requests/[requestId]`
- **Sync:** customer cancellations of **paid** orders and return requests create service requests (`order-actions.service.js`); unpaid cancellations just release their stock
- **Decisions reach the order:** approving a return marks the order's return approved; rejecting returns the order to `delivered`; refunding or completing it marks the order `returned` (`applyReturnDecisionToOrder`). The customer sees each step on their order page.
- **Refunds:** `initiateRefund: true` on PATCH reuses `createAdminRefund` (Razorpay), no duplicate pending refunds. The `refund.processed` webhook marks the request `refunded`.
- **Windows:** cancellation and return windows are enforced (see `ORDER_MANAGEMENT.md`).
- **Legacy data:** requests recorded on orders before service requests existed are imported by `npm run orders:migrate -- --tenant <slug> --apply`.

# Admin customers

- **UI:** `/admin/customers`, `/admin/customers/[customerId]`
- **API:** `GET /api/v1/customers`, `GET /api/v1/customers/summary`, `GET/PATCH /api/v1/customers/[customerId]`
- **Auth:** `requireCommerceAdmin`
- **Data:** MongoDB `User` (role `customer`) with order aggregates from `Order`

## Capabilities

Summary cards, server-side search/filter/pagination, customer detail with order overview, profile PATCH including `isActive` suspend/reactivate.

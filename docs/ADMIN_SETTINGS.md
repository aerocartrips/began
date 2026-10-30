# Admin settings

- **UI:** `/admin/settings` (tabs: general, business, orders, shipping, integrations)
- **API:** `GET/PATCH /api/v1/admin/settings`, `GET /api/v1/admin/settings/health`
- **Persistence:** `StoreSettings` (`key: store`), version incremented on each PATCH

Secrets are never stored in MongoDB or returned by APIs. Integration health reports configured/status only.

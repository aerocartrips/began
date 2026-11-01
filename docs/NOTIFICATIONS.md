# Notifications

In-app notifications for customers (storefront bell, `/account/notifications`) and admins (dashboard bell, `/admin/notifications`), stored in MongoDB.

## Flow

```text
Business service (order, payment, refund, shipment, support, product)
  -> commits its own state change first
  -> lib/notifications/events.js       (event -> notification content + dedupe key)
  -> dispatchNotification()            (runs after the response via next/server `after`; retries once; logs, never throws)
  -> notification.service              (preferences, admin targeting, optional email)
  -> notification.repository           (single idempotent bulkWrite)
```

A notification failure can't fail, delay, or roll back checkout, payment verification, or any other business operation. Failures are logged as `Notification delivery failed` along with the event name.

## Schema (`Notification`)

| Field | Notes |
| --- | --- |
| `recipientType` | `customer` or `admin` |
| `recipientId` | User id. Env-only dashboard admins (`ADMIN_EMAIL`) get a stable id derived from their email |
| `audience` | Admin scope: `commerce`, `finance`, `support`, `operations`, `catalog` (null for customers) |
| `type`, `severity` | See `lib/constants/notifications.js`. Severity is `info`, `success`, `warning` or `critical` |
| `title`, `message`, `url` | Display text plus an app-relative link. No payment or address data is stored |
| `entityType`, `entityId` | Related record |
| `isRead`, `readAt` | Read state |
| `dedupeKey` | Idempotency key per recipient, e.g. `order:<id>:paid` |
| `groupKey`, `groupCount` | Unread notifications with the same group key are merged (support chat bursts) |
| `metadata` | Small display data such as the order number or status |
| `email` | Delivery state of the optional email (`sent`, `skipped` or `failed`) |
| `expiresAt` | TTL retention (`NOTIFICATION_RETENTION_DAYS`, default 180) |

Indexes:

- `{recipientType, recipientId, createdAt -1, _id -1}`: inbox listing with cursor pagination.
- Partial `{recipientType, recipientId, createdAt -1}` where `isRead: false`: unread count and mark-all-read.
- Unique partial `{recipientType, recipientId, dedupeKey}`: deduplication.
- Unique partial `{recipientType, recipientId, groupKey}` where unread: grouping.
- TTL on `expiresAt`.

## Idempotency

Each event uses a deterministic key, so webhook retries, verify/webhook races and repeated requests all end up on the same document. The writes are `$setOnInsert` upserts, and MongoDB retries upserts that race on a unique index. Order status notifications are keyed by order and status (`order:<id>:status:<status>`). If an admin and the Delhivery tracking feed both report "delivered", the customer gets one notification.

## APIs

Customer endpoints require the storefront session. Admin endpoints go through `requireAdminAccess` and are filtered by the admin's allowed audiences.

| Method | Customer | Admin |
| --- | --- | --- |
| GET | `/api/v1/notifications?limit=&cursor=&unread=1` | `/api/v1/admin/notifications` |
| GET | `/api/v1/notifications/unread-count` | `/api/v1/admin/notifications/unread-count` |
| PATCH | `/api/v1/notifications/{id}/read` | `/api/v1/admin/notifications/{id}/read` |
| PATCH | `/api/v1/notifications/read-all` | `/api/v1/admin/notifications/read-all` |

The list endpoint returns `meta: { hasMore, nextCursor, unreadCount }`. Read endpoints return the new `unreadCount`. The recipient always comes from the session, and a notification that belongs to someone else returns 404.

Back-in-stock subscriptions: `GET | PUT | DELETE /api/v1/products/{productId}/stock-alert`.

## Permissions

`allowedAdminAudiences()` in `lib/notifications/admin-recipients.js` is the single place to restrict admins by role. Delivery targeting and the read APIs both use it. There is only one admin role today, so every admin sees every audience.

## Real-time updates

There's no WebSocket infrastructure, so the bell polls `unread-count`:

- There's one shared poller per scope, regardless of how many components are mounted.
- Polling only runs while the tab is visible, and it refreshes on focus.
- It stops on 401/403 and when the bell unmounts (for example on sign-out).
- The interval is `NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL_MS` (default 30 s, minimum 5 s).

An open list reloads when the polled count changes.

## Preferences

Order, payment, delivery, refund and support notifications are transactional and always appear in-app. `notificationPreferences.backInStock` controls back-in-stock alerts. Emails are a separate channel: they are off unless `CUSTOMER_NOTIFICATION_EMAILS=true` and `RESEND_API_KEY` are set, and they honour the existing `orderUpdates` and `shippingUpdates` email preferences.

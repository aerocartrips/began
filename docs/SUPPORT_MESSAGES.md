# Support messages

One MongoDB-backed system serves the customer chat (`/account/support`), the public contact form and the admin inbox (`/admin/messages`). All three read and write the same `SupportConversation` / `SupportMessage` records.

## Data model

`SupportConversation` (additive fields are optional, so older records keep working):

| Field | Notes |
|-------|-------|
| `customer` | Owner. Set from the session, never from the request body. Empty for guest contact-form messages. |
| `category` | `order`, `payment`, `shipping`, `product`, `return`, `other` (default `other`) |
| `source` | `account` (chat) or `contact` (contact form, default) |
| `order` | Optional order; must belong to the customer |
| `status` | `open`, `in_progress`, `waiting_customer`, `resolved`, `closed` |
| `lastMessageAt` / `lastMessagePreview` / `lastMessageRole` | Denormalised for list views. Older rows get a preview backfilled at read time with one aggregation. |
| `unreadByAdmin` / `unreadByCustomer` | Recomputed from message read flags when a side marks the thread read |
| `resolvedAt` | Set when staff resolve the thread. Drives the 30-day reopen window. |
| `clientRequestId` | Idempotency key for "start conversation". Unique per customer (partial index). |
| `internalNotes`, `priority`, `assignedAdmin` | Staff only. Never sent to customers. |

`SupportMessage` adds `clientMessageId`, an idempotency key that is unique per conversation (partial index). Index `{ conversation, createdAt, _id }` backs cursor pagination.

### Customer-facing status

| Stored status | Customer sees |
|---------------|---------------|
| `open` | Open |
| `in_progress`, `waiting_customer` | Pending |
| `resolved` | Resolved. A reply within 30 days reopens it. |
| `closed` | Closed (read-only) |

When a customer replies: `resolved` becomes `open` and `waiting_customer` becomes `in_progress`. When staff reply: `open` becomes `in_progress`.

## Customer API (session required; every query is scoped to the session user)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/support/conversations?page&limit` | Newest activity first. `meta`: pagination plus `unreadConversations` |
| POST | `/api/v1/support/conversations` | `{ category, subject, message, orderId?, clientRequestId? }`. Returns 201 when created, 200 when replayed. Rate limit: 5/hour. |
| GET | `/api/v1/support/conversations/:id` | 404 for missing *or* foreign ids |
| PATCH | `/api/v1/support/conversations/:id` | Only `{ status: "closed" }`. Anything else returns 403. |
| GET | `/api/v1/support/conversations/:id/messages?before\|after&limit` | Latest page first. Items are returned oldest to newest. `meta.hasMore`, `meta.conversation`. Max 50 per page. |
| POST | `/api/v1/support/conversations/:id/messages` | `{ body, clientMessageId? }`, body 1–5000 chars. Returns 409 when closed. Rate limit: 30 per 5 min. |
| POST | `/api/v1/support/conversations/:id/read` | Marks staff messages read |

Cursors are opaque strings taken from each message's `cursor`.

## Admin API (admin session)

| Method | Path |
|--------|------|
| GET | `/api/v1/admin/support/conversations?status&category&view=awaiting\|unread&search&page&limit` |
| GET / PATCH | `/api/v1/admin/support/conversations/:id` (detail with latest messages and marks read / `{ status, priority, internalNotes, assignedAdmin }`) |
| GET / POST | `/api/v1/admin/support/conversations/:id/messages` (paginated thread / reply `{ body, clientMessageId? }`) |
| POST | `/api/v1/admin/support/conversations/:id/read` |

The older collection-level `PATCH`/`POST` (with `conversationId` in the body) still work.

## Client behaviour

- Polling only, no websockets. The open thread polls `?after=<newest cursor>` every `NEXT_PUBLIC_SUPPORT_POLL_INTERVAL_MS` (default 8000). The conversation list refreshes every `NEXT_PUBLIC_SUPPORT_LIST_POLL_INTERVAL_MS` (default 30000).
- Polling stops while the tab is hidden and backs off up to 60s on errors. In-flight requests are aborted on unmount.
- Sends are optimistic. A failed send can be retried with the same `clientMessageId`, so the server never stores it twice.
- On a 401 the client calls `/api/v1/auth/refresh` once, then retries.

## Contact form

`POST /api/v1/contact` creates a `source: "contact"` conversation. If the visitor is signed in as a customer, it is linked to their account and also shows up in `/account/support`. Guests cannot read replies online, so staff follow up by email.

## Migration

Run `npm run import:legacy-contacts` once to import the retired `.data/contact-messages.json` store. It is idempotent via `legacyContactId`. No other migration is needed: the new fields have defaults or read-time fallbacks, and Mongoose builds the new indexes automatically.

## Tests

`tests/integration/support-chat.integration.test.js` runs the route handlers against an in-memory MongoDB (`mongodb-memory-server`, downloaded on first run). `tests/unit/support-chat.test.js` covers the pure helpers.

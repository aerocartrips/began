# Support messages

- **Models:** `SupportConversation`, `SupportMessage`
- **UI:** `/admin/messages`, `/admin/messages/[id]`
- **API:** `GET/PATCH/POST /api/v1/admin/support/conversations`, `GET /api/v1/admin/support/conversations/[conversationId]`
- **Contact form:** still writes JSON backup; also creates Mongo conversation when `MONGODB_URI` is set
- **Migration:** legacy `.data/contact-messages.json` imported on first inbox load (`legacyContactId`), originals kept on disk

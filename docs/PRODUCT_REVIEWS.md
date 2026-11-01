# Product reviews and ratings

Norosilk uses verified-purchase reviews stored in MongoDB, moderated by admins, and aggregated on product pages.

## Eligibility

Customers may submit or update a review when:

1. They are authenticated (JWT HTTP-only cookies).
2. The order belongs to them.
3. Order fulfillment status is `delivered`.
4. The product appears on that order’s line items.

Cancelled, pending, processing, packed, shipped, and out-for-delivery orders are **not** eligible.

## Review policy

- **One review per customer per product** (unique index on `user + product`).
- Submitting again **updates** the existing review and sets moderation back to `pending`.
- The linked `order` field is updated to the order used for the latest verified submission.
- **Verified purchase** badge is shown when eligibility was verified server-side.

## Payment vs moderation

- `moderationStatus`: `pending` | `approved` | `rejected`
- Only **approved** reviews appear on public product pages and count toward `Product.ratingSummary`.

## Schema

### `Review`

- `user`, `product`, `order` (ObjectIds)
- `rating` (1–5), `title`, `comment`
- `images[]` (Cloudinary metadata)
- `verificationStatus`: `verified_purchase`
- `moderationStatus`, `moderationNote`, `moderatedAt`, `moderatedBy`
- Unique index: `{ user: 1, product: 1 }`

### `Product.ratingSummary`

- `averageRating`, `totalReviews`, `distribution` (1–5 counts)
- Recomputed when reviews are approved, rejected, or deleted.

## APIs

### Customer (auth required)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/reviews` | Create or update review (JSON) |
| PATCH | `/api/v1/reviews/[reviewId]` | Update own review |
| DELETE | `/api/v1/reviews/[reviewId]` | Delete own review |
| POST | `/api/v1/reviews/[reviewId]/images` | Upload review photos (multipart) |
| DELETE | `/api/v1/reviews/[reviewId]/images?imageId=` | Remove own review photo |
| POST | `/api/v1/reviews/order-context` | Review state per product for delivered orders |
| GET | `/api/v1/account/reviews` | Customer’s reviews |

### Public

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/products/[productId]/reviews` | Approved reviews + summary (paginated, sort/filter) |

### Admin (`requireAdminAccess`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/admin/reviews` | List/filter/search |
| PATCH | `/api/v1/admin/reviews/[reviewId]/moderate` | Approve or reject |
| DELETE | `/api/v1/admin/reviews/[reviewId]` | Delete review + recompute ratings |

## Cloudinary

- Customer uploads use folder `norosilk/reviews` via dedicated review image routes (not admin `/api/v1/upload`).
- Max **5** images per review, **10 MB** each, JPEG/PNG/WebP.
- Orphan cleanup: images removed on review/photo delete when public IDs are under `norosilk/`.
- Delivery URLs use `f_auto`, `q_auto` presets from `lib/cloudinary/transformations.js`.

## UI

- `/account/orders` — per-product review actions on **delivered** orders
- Product detail — rating summary + reviews section (database products only)
- `/admin/reviews` — moderation dashboard

## Testing

```bash
npm run test -- tests/unit/product-reviews.test.js
```

## Security

- Order ownership and delivered status verified on every create/update.
- Product must be on the verified order line items.
- Clients cannot set moderation status, aggregates, or untrusted Cloudinary IDs on create.
- Admin moderation routes use existing commerce admin authorization.

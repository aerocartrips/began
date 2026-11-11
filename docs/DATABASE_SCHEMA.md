# Database Schema

All collections use Mongoose timestamps (`createdAt`, `updatedAt`) unless noted.

## User

| Field | Type | Notes |
| --- | --- | --- |
| name | String | required |
| email | String | unique, lowercase, indexed |
| password | String | bcrypt hash, `select: false` |
| phone | String | optional |
| role | enum | `customer`, `admin` |
| companyName | String | B2B |
| gstNumber | String | optional |
| isActive | Boolean | default true |
| isEmailVerified | Boolean | default false; storefront sessions require true (when email can be sent) |
| emailVerification | Object | outstanding emailed code: `pendingEmail` (address it went to), `codeHash` (HMAC, `select: false`), `expiresAt`, `attempts`, `sentAt` |
| addresses | Array | embedded address subdocuments |

Indexes: unique email, `(role, isActive)`.

## Category

| Field | Type | Notes |
| --- | --- | --- |
| name | String | required |
| slug | String | unique |
| description | String | |
| image | `{ url, alt }` | |
| parentCategory | ObjectId | self-reference for hierarchy |
| isActive | Boolean | |
| sortOrder | Number | |

## Product

Wholesale-focused catalog item with text search index on `name`, `sku`, `shortDescription`.

Key fields: `slug`, `sku`, `category`, `images[]`, fabric/weaving metadata, `price`, `wholesalePrice`, `bulkPricingTiers[]`, `minimumOrderQuantity`, `stockQuantity`, `status`, `featured`, `popularityScore`, SEO fields.

Indexes: unique slug/sku, text index, `(wholesalePrice, status)`, `(createdAt)`.

## Order

| Field | Type | Notes |
| --- | --- | --- |
| orderNumber | String | unique human-readable id |
| customer | ObjectId | User |
| items | Array | snapshot: name, sku, qty, unitPrice, lineTotal, attributes |
| shippingAddress / billingAddress | Object | snapshot |
| subtotal, discount, shippingCharges, tax, totalAmount | Number | server calculated |
| paymentMethod | String | |
| paymentStatus | enum | pending, paid, failed, refunded |
| orderStatus | enum | pending, confirmed, processing, shipped, delivered, cancelled |
| notes | String | |

## Cart

One document per user (`user` unique). Items: `{ product, quantity, selectedAttributes }`.

## Wishlist

One document per user. `products`: array of Product ObjectIds.

## Address

Standalone saved addresses linked to `user` (optional complement to embedded user addresses).

## Relationships

```text
User 1---* Order
User 1---1 Cart
User 1---1 Wishlist
User 1---* Address
Category 1---* Product
Product *---* Wishlist.products
```

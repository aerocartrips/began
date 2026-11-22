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

A catalogue item of one product type. Its details and variant options come from the type and the attribute library (see README → Product types).

| Field | Type | Notes |
| --- | --- | --- |
| productType | ObjectId | ProductType; decides the details asked for and the variant options |
| typeHidden | Boolean | true while the type is switched off; every storefront and purchase read skips it (`listedProductFilter()`) |
| attributes | `[{ key, value }]` | details (Fabric, Fit…) in the attribute library's spelling; a multi-list detail has one entry per value |
| variants | Array | `{ options (Map: color → "Black", size → "M"), title ("Black / M", derived), colorName, colorHex, sku, barcode, stockQuantity, sortOrder }`; variant `_id`s are stable (carts, orders, stock ledger and alerts point at them) |
| colorMedia | Array | `{ color, images[] }`: photos per colour |
| colors, sizeRange | derived | colour names (filters) and "S–XXL" (cards) |
| sizeChart | Object | optional override of the type's size chart |
| searchText | String | detail and option values for the text index, `select: false` |
| stockQuantity | Number | sum of the variants' stock |

Other fields: `slug`, `previousSlugs`, `sku`, `category`, `images[]`, `price`, `wholesalePrice`, `bulkPricingTiers[]`, `minimumOrderQuantity`, `status`, `featured`, `popularityScore`, `salesCount`, `trendingScore`, SEO fields.

Indexes (all start with `tenantId`): unique slug and sku; `variants.sku`; text index `product_text` on `name`, `sku`, `shortDescription`, `searchText`; listing sorts by status with category or product type; `(status, attributes.key, attributes.value)` for detail filters; `(status, colors)`.

## ProductType

What a store sells (Saree, T-shirt, Jeans…). `isActive` is "on sale".

| Field | Type | Notes |
| --- | --- | --- |
| name, pluralName | String | "T-shirt", "T-shirts" |
| slug | String | unique per store; `/shop/<slug>`; `previousSlugs` redirect |
| icon, description, sortOrder | | |
| isActive | Boolean | switching it off sets `typeHidden` on the type's products |
| fields | `[{ key, required }]` | details the product form asks for (attribute keys) |
| options | `[{ key, values[] }]` | up to 3 variant options (Colour × Size…) and the values offered |
| sizeChart | Object | `{ optionKey, unit (in/cm), columns [{ label, primary, measurement }], rows [{ size, values[] }], note, howToMeasure }` |
| defaults | Object | `hsnCode`, `gstRatePercent`, `minimumOrderQuantity`, `careInstructions` for new products |
| template | String | the template it came from (`saree`, `t-shirt`…), if any |

Indexes: unique `(tenantId, slug)`, `(tenantId, previousSlugs)`, `(tenantId, isActive, sortOrder)`.

## ProductAttribute

The store's attribute library: one document per detail or option, shared by every product type.

| Field | Type | Notes |
| --- | --- | --- |
| key | String | unique per store, immutable; also the URL filter name (`?fabric=Cotton`) |
| name | String | "Fabric" |
| input | enum | `select`, `multiselect`, `color`, `text`, `number`, `boolean`; immutable |
| unit | String | for numbers ("m", "cm") |
| values | Array | `{ label, slug, hex, sortOrder, isActive }` for list and colour inputs |
| filterable, visible | Boolean | storefront filter; shown in product specs |
| schemaProperty | String | schema.org mapping: material, pattern, color, size, suggestedGender, suggestedAge |
| helpText, sortOrder | | |

Indexes: unique `(tenantId, key)`, `(tenantId, sortOrder, name)`. Replaces the old `attributes` collection (read once by `npm run catalog:upgrade`).

## StockAlert

Back-in-stock subscriptions: `product`, `variantId` (null for the whole product), `customer`, `notifiedAt`. Unique per `(tenantId, product, variantId, customer)`.

## Order

| Field | Type | Notes |
| --- | --- | --- |
| orderNumber | String | unique human-readable id |
| customer | ObjectId | User |
| items | Array | snapshot: name, sku, variantId, variantTitle ("Black / M"), options `[{ name, value }]`, colorName, qty, unitPrice, lineTotal |
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
ProductType 1---* Product
ProductAttribute 1---* ProductType.fields / ProductType.options (by key)
Product *---* Wishlist.products
```

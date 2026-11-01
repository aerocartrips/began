# Image Management

## Architecture

- Original assets are stored once in Cloudinary.
- MongoDB stores metadata only (`publicId`, `secureUrl`, dimensions, alt text, sort order, primary flag).
- Storefront delivery URLs are generated dynamically using transformation presets in `lib/cloudinary/transformations.js`.

## Presets

| Preset | Transformation |
| --- | --- |
| Thumbnail | `w_300,h_400,c_fill,f_auto,q_auto` |
| Product card | `w_600,h_800,c_fill,f_auto,q_auto` |
| Product detail | `w_1200,h_1600,c_limit,f_auto,q_auto` |
| High resolution | `w_2000,h_2500,c_limit,f_auto,q_auto` |

Example:

```text
https://res.cloudinary.com/<cloud>/image/upload/w_600,h_800,c_fill,f_auto,q_auto/norosilk/products/sarees/aurora-silk-44-1
```

## Folder layout

```text
norosilk/products/sarees
norosilk/products/silk
norosilk/products/cotton
norosilk/products/handloom
norosilk/categories
norosilk/banners
norosilk/collections
norosilk/blog
```

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/upload` | Standalone multi-image upload |
| POST | `/api/v1/products/:productId/images` | Upload and attach to product |
| PATCH | `/api/v1/products/:productId/images` | Update alt text, primary image, ordering |
| DELETE | `/api/v1/products/:productId/images/:imageId` | Remove image from product and Cloudinary |

## Frontend components

- `components/images/product-image.tsx`
- `components/images/product-gallery.tsx`
- `components/images/image-uploader.tsx`
- `components/images/image-preview.tsx`

## Safety rules

- Admin-only uploads and deletions.
- MIME and size validation on the server.
- Managed public ID prefix enforcement (`norosilk/`).
- MongoDB image references are not removed if Cloudinary deletion fails.

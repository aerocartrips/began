# Cloudinary Setup

## 1. Create a Cloudinary account

1. Sign up at [https://cloudinary.com](https://cloudinary.com).
2. Open the Dashboard.
3. Copy:
   - Cloud Name
   - API Key
   - API Secret

## 2. Configure environment variables

Add to `.env.local`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

Never expose `CLOUDINARY_API_SECRET` to the browser. Only the cloud name is public.

## 3. Local development

1. Install dependencies: `npm install`
2. Configure MongoDB and Cloudinary env vars.
3. Sign in to `/admin/login` (dashboard admin) or create a MongoDB admin user for API auth.
4. Upload images from the admin product form or via API.

## 4. Production deployment

Set the same environment variables in your hosting provider. Restrict Cloudinary API key usage to trusted server environments.

## 5. Upload API example

`POST /api/v1/upload`

`multipart/form-data`:

- `files`: one or more images
- `folder` (optional): one of the allowed `norosilk/...` folders
- `fabric` (optional): used to infer product folder

Requires admin access (dashboard admin cookie or MongoDB admin JWT).

## 6. Delete API example

`DELETE /api/v1/products/{productId}/images/{imageId}`

Deletes the Cloudinary asset only after verifying the image belongs to the product and uses a managed `norosilk/` public ID.

## 7. Troubleshooting

| Issue | Fix |
| --- | --- |
| `503 Cloudinary is not configured` | Set all three Cloudinary server env vars |
| Upload returns `401` | Sign in to admin dashboard or API admin account |
| Images do not render | Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and restart dev server |
| Delete fails but DB unchanged | Expected safety behavior; retry or remove asset manually in Cloudinary |

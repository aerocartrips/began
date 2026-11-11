import { ImageResponse } from "next/og";
import { BRAND_ICON_FILES, monogramOf } from "@/lib/seo/brand-icon";
import { squareIcon } from "@/lib/seo/images";
import { tenantForDomain } from "@/lib/seo/sitemap";

type IconFile = keyof typeof BRAND_ICON_FILES;

const isIconFile = (file: string): file is IconFile => Object.hasOwn(BRAND_ICON_FILES, file);

/**
 * The store's favicons at fixed addresses (/icons/icon-48.png …): its own icon
 * resized to a square, or, when it has none, its initial on its brand colour.
 * Head links carry `?v=` (lib/seo/brand-icon.js), so responses cache for good.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ domain: string; file: string }> }) {
  const { domain, file } = await params;
  const tenant = isIconFile(file) ? await tenantForDomain(domain) : null;
  if (!tenant || !isIconFile(file)) return new Response("Not found", { status: 404 });

  const size = BRAND_ICON_FILES[file];
  const favicon = tenant.branding.faviconUrl;
  if (favicon) return Response.redirect(squareIcon(favicon, size) ?? favicon, 302);

  const background = tenant.branding.theme.brand || "#6863ed";
  // Apple draws its own rounded corners and shows transparency as black: square, opaque.
  const radius = file === "apple-touch-icon.png" ? 0 : Math.round(size * 0.22);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
          borderRadius: radius,
          color: "#ffffff",
          fontSize: Math.round(size * 0.62),
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {monogramOf(tenant)}
      </div>
    ),
    { width: size, height: size },
  );
}

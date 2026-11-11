import type { Metadata } from "next";
import GuideCard from "@/components/guides/guide-card";
import { getPublishedGuides } from "@/lib/content/guides";
import { shareImage } from "@/lib/seo/images";
import { pageMetadata, siteNameOf } from "@/lib/seo/metadata";
import { getCurrentTenant } from "@/lib/tenant/current";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const guides = await getPublishedGuides(tenant.id);
  const cover = guides.find((guide) => guide.coverImage);
  return pageMetadata(tenant, {
    title: "Buying guides",
    description: `Fabric, weave and care guides from ${siteNameOf(tenant)}: know your sarees before you buy.`,
    path: "/guides",
    // An empty index adds nothing for search engines.
    robots: guides.length ? "index" : "noindex",
    images: cover?.coverImage ? [shareImage(cover.coverImage.url, cover.coverAlt || cover.title)] : undefined,
  });
}

export default async function GuidesPage() {
  const tenant = await getCurrentTenant();
  const guides = await getPublishedGuides(tenant.id);
  return (
    <main className="guides-page content-width">
      <header className="catalog-header">
        <div>
          <h1>Buying guides</h1>
          <p>Know your fabrics, weaves and care before you buy.</p>
        </div>
      </header>
      {guides.length ? (
        <ul className="guide-grid">
          {guides.map((guide) => (
            <li key={guide.id}>
              <GuideCard guide={guide} headingLevel="h2" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="catalog-empty">
          <h2>No guides yet</h2>
          <p>Check back soon for fabric and care guides.</p>
        </div>
      )}
    </main>
  );
}

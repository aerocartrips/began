import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Boxes, FileText, Truck } from "lucide-react";
import Button from "@/components/ui/button";
import ProductGrid from "@/components/catalog/product-grid";
import RecentlyViewed from "@/components/catalog/recently-viewed";
import { getCategories, getFeaturedProducts } from "@/lib/catalog/query";
import { getCurrentTenant } from "@/lib/tenant/current";

const WHOLESALE_POINTS = [
  { icon: Boxes, title: "Quantity pricing", text: "Per-piece prices drop as your order grows." },
  { icon: FileText, title: "Custom quotes", text: "Request pricing for large or custom orders." },
  { icon: BadgeCheck, title: "GST invoices", text: "Tax invoices with your GSTIN on every order." },
  { icon: Truck, title: "Pan-India dispatch", text: "Tracked shipping on every consignment." },
];

const RETAIL_POINTS = [
  { icon: BadgeCheck, title: "Authentic weaves", text: "Every saree is checked before it ships." },
  { icon: Truck, title: "Tracked delivery", text: "Follow your order from dispatch to doorstep." },
  { icon: Boxes, title: "Easy returns", text: "Simple returns within the return window." },
];

export default async function Home() {
  const tenant = await getCurrentTenant();
  const [categories, featured] = await Promise.all([
    getCategories(tenant.id),
    getFeaturedProducts(tenant.id, tenant.salesMode, 8),
  ]);
  const isWholesale = tenant.salesMode === "wholesale";
  const { siteTitle, tagline, description, heroImageUrl } = tenant.branding;
  const points = isWholesale ? WHOLESALE_POINTS : RETAIL_POINTS;
  const visibleCategories = categories.filter((category) => category.productCount > 0).slice(0, 8);

  return (
    <>
      <header className="hero">
        <div className="hero-grid content-width">
          <div className="hero-copy">
            <h1>{tagline || siteTitle}</h1>
            {description ? <p className="hero-description">{description}</p> : null}
            <div className="hero-actions">
              <Button href="/products" icon={<ArrowRight size={15} aria-hidden="true" />}>Shop the catalogue</Button>
              {isWholesale ? <Button href="/request-quote" variant="secondary">Request a quote</Button> : null}
            </div>
          </div>
          {heroImageUrl ? (
            <div className="hero-visual">
              <div className="hero-image-frame">
                <Image
                  src={heroImageUrl}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 760px) 92vw, (max-width: 1100px) 70vw, 45vw"
                  className="cover-image hero-image"
                />
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="content-width home-sections">
        {visibleCategories.length > 0 ? (
          <section aria-labelledby="home-categories">
            <div className="section-row">
              <h2 id="home-categories">Shop by category</h2>
              <Link className="text-link" href="/categories">All categories</Link>
            </div>
            <ul className="category-grid">
              {visibleCategories.map((category) => (
                <li key={category.id}>
                  <Link href={`/categories/${category.slug}`} className="category-tile">
                    <span className="category-tile__media">
                      {category.imageUrl ? (
                        <Image src={category.imageUrl} alt="" fill sizes="(max-width: 640px) 50vw, 25vw" className="cover-image" />
                      ) : null}
                    </span>
                    <span className="category-tile__name">{category.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {featured.length > 0 ? (
          <section aria-labelledby="home-featured">
            <div className="section-row">
              <h2 id="home-featured">Featured</h2>
              <Link className="text-link" href="/products">View all</Link>
            </div>
            <ProductGrid products={featured} salesMode={tenant.salesMode} priorityCount={4} label="Featured products" />
          </section>
        ) : null}

        <section className="value-points" aria-label={`Why buy from ${tenant.name}`}>
          {points.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <Icon size={22} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <RecentlyViewed salesMode={tenant.salesMode} />
      </main>
    </>
  );
}

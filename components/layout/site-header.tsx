import { Suspense } from "react";
import BrandLink from "@/components/ui/brand-link";
import Button from "@/components/ui/button";
import CartCount from "@/features/cart/components/cart-count";
import HeaderAccount, { HeaderAccountFallback } from "@/components/layout/header-account";
import MobileMenu from "@/components/layout/mobile-menu";
import MobileSearch from "@/components/layout/mobile-search";
import StorefrontSearch from "@/components/layout/storefront-search";
import ShopMenu from "@/components/layout/shop-menu";
import { getSiteNavigation } from "@/lib/site-content";
import { getCatalogConfig, sellingTypes } from "@/lib/catalog/catalog-config";
import { getCategoryOverview } from "@/lib/catalog/home";
import { inSentence } from "@/lib/seo/descriptions";
import { getCurrentTenant } from "@/lib/tenant/current";
import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";

/** Categories listed under each type in the Shop menu (the type's page lists the rest). */
const MENU_CATEGORIES = 6;

export default async function SiteHeader() {
  const tenant = await getCurrentTenant();
  const navigation = getSiteNavigation();
  const isWholesale = tenant.salesMode === "wholesale";
  const selling = sellingTypes(await getCatalogConfig(tenant.id));
  // A store selling several types shows them under "Shop" with their categories; one type is the whole catalogue.
  const multiType = selling.length > 1;
  const categories = multiType ? await getCategoryOverview(tenant.id, tenant.salesMode) : [];
  const largest = (list: typeof categories) =>
    [...list].sort((left, right) => right.productCount - left.productCount).slice(0, MENU_CATEGORIES).map(({ name, slug }) => ({ name, slug }));
  const types = selling.map((type) => ({
    name: type.pluralName,
    slug: type.slug,
    icon: type.icon,
    count: type.productCount,
    categories: largest(categories.filter((category) => category.typeId === type.id)),
  }));
  const collections = largest(categories.filter((category) => !selling.some((type) => type.id === category.typeId)));
  const searchPlaceholder = types.length
    ? `Search ${types.slice(0, 2).map((type) => inSentence(type.name)).join(", ")}${types.length > 2 ? "…" : ", SKU…"}`
    : "Search products, SKU…";

  return (
    <header className="site-nav ">
      <div className="nav-brand-group">
        <MobileMenu types={multiType ? types.map((type) => ({ label: type.name, href: `/shop/${type.slug}`, icon: type.icon })) : []} />
        <BrandLink href="/" />
        <nav className="nav-links" aria-label="Main navigation">
          {navigation.map((item) =>
            multiType && item.href === "/products" ? (
              <ShopMenu key={item.href} types={types} collections={collections} />
            ) : (
              <Link href={item.href} key={item.href}>{item.label}</Link>
            ),
          )}
        </nav>
      </div>
      <div className="nav-actions">
        <StorefrontSearch placeholder={searchPlaceholder} />
        {/* Every header icon is a .nav-icon-button: one size, one hover, badges on the same corner. */}
        <div className="nav-icons">
          <MobileSearch placeholder={searchPlaceholder} />
          <Link className="nav-icon-button nav-wishlist-link" href="/wishlist" aria-label="Wishlist">
            <Heart size={19} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          {/* Named by CartCount ("Shopping cart, 42 items"), so the count is announced too. */}
          <Link className="nav-icon-button" href="/cart">
            <ShoppingCart size={19} strokeWidth={1.8} aria-hidden="true" />
            <CartCount />
          </Link>
          {/* The only per-visitor part of the header: the rest stays in the static shell. */}
          <Suspense fallback={<HeaderAccountFallback />}>
            <HeaderAccount />
          </Suspense>
        </div>
        {isWholesale ? (
          <Button href="/request-quote" variant="portal">Request a quote</Button>
        ) : null}
      </div>
    </header>
  );
}

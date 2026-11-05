import BrandLink from "@/components/ui/brand-link";
import Button from "@/components/ui/button";
import CartCount from "@/features/cart/components/cart-count";
import CustomerAccountMenu from "@/components/layout/customer-account-menu";
import MobileMenu from "@/components/layout/mobile-menu";
import MobileSearch from "@/components/layout/mobile-search";
import StorefrontSearch from "@/components/layout/storefront-search";
import { getSiteNavigation } from "@/lib/site-content";
import { getCurrentTenant } from "@/lib/tenant/current";
import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";

export default async function SiteHeader() {
  const tenant = await getCurrentTenant();
  const navigation = getSiteNavigation(tenant.salesMode);
  const isWholesale = tenant.salesMode === "wholesale";

  return (
    <header className="site-nav">
      <div className="nav-brand-group">
        <MobileMenu />
        <BrandLink href="/" />
        <nav className="nav-links" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
      </div>
      <div className="nav-actions">
        <StorefrontSearch />
        <MobileSearch />
        <Link className="cart-link nav-wishlist-link" href="/wishlist" aria-label="Wishlist">
          <Heart size={19} strokeWidth={1.8} aria-hidden="true" />
        </Link>
        <Link className="cart-link" href="/cart" aria-label="Shopping cart">
          <ShoppingCart size={19} strokeWidth={1.8} aria-hidden="true" />
          <CartCount />
        </Link>
        <CustomerAccountMenu />
        {isWholesale ? (
          <Button href="/request-quote" variant="portal">Request a quote</Button>
        ) : null}
      </div>
    </header>
  );
}

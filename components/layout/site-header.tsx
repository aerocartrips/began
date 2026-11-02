import BrandLink from "@/components/ui/brand-link";
import Button from "@/components/ui/button";
import CartCount from "@/features/cart/components/cart-count";
import CustomerAccountMenu from "@/components/layout/customer-account-menu";
import StorefrontSearch from "@/components/layout/storefront-search";
import { getSiteNavigation } from "@/lib/site-content";
import { getCurrentTenant } from "@/lib/tenant/current";
import Link from "next/link";
import { Heart, Menu, ShoppingCart } from "lucide-react";

export default async function SiteHeader() {
  const tenant = await getCurrentTenant();
  const navigation = getSiteNavigation(tenant.salesMode);
  const isWholesale = tenant.salesMode === "wholesale";

  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="nav-brand-group">
        <BrandLink href="/" />
        <div className="nav-links">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </div>
        <details className="mobile-menu">
          <summary aria-label="Site navigation">
            <Menu size={20} aria-hidden="true" />
          </summary>
          <div className="mobile-menu-panel">
            {navigation.map((item) => (
              <Link href={item.href} key={item.href}>{item.label}</Link>
            ))}
            <Link href="/wishlist">Wishlist</Link>
            <Link href="/account/orders">My orders</Link>
          </div>
        </details>
      </div>
      <div className="nav-actions">
        <StorefrontSearch />
        <Link className="cart-link" href="/wishlist" aria-label="Wishlist">
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
    </nav>
  );
}

import BrandLink from "@/components/ui/brand-link";
import Button from "@/components/ui/button";
import CartCount from "@/features/cart/components/cart-count";
import CustomerAccountMenu from "@/components/layout/customer-account-menu";
import StorefrontSearch from "@/components/layout/storefront-search";
import { siteNavigation } from "@/lib/site-content";
import Link from "next/link";
import { Menu, ShoppingCart } from "lucide-react";

export default function SiteHeader() {
  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="nav-brand-group">
        <BrandLink href="/#top" />
        <div className="nav-links">
          {siteNavigation.map((item) => (
            <Link href={item.href} key={item.label}>{item.label}</Link>
          ))}
        </div>
        <details className="mobile-menu">
          <summary aria-label="Site navigation">
            <Menu size={20} aria-hidden="true" />
          </summary>
          <div className="mobile-menu-panel">
            {siteNavigation.map((item) => (
              <Link href={item.href} key={item.label}>{item.label}</Link>
            ))}
            <Link href="/account/orders">My orders</Link>
            <Link href="/account/reviews">My reviews</Link>
            <Link href="/account/login">Sign in</Link>
          </div>
        </details>
      </div>
      <div className="nav-actions">
        <StorefrontSearch />
        <Link className="cart-link" href="/cart" aria-label="Shopping cart">
          <ShoppingCart size={19} strokeWidth={1.8} aria-hidden="true" />
          <CartCount />
        </Link>
        <CustomerAccountMenu />
        <Button href="/#enterprise" variant="portal">Portal Access</Button>
      </div>
    </nav>
  );
}
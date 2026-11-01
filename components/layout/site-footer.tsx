import BrandLink from "@/components/ui/brand-link";
import FooterColumn from "@/components/layout/footer-column";
import { footerColumns } from "@/lib/site-content";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-grid content-width">
        <div className="footer-about">
          <BrandLink href="/#top" />
          <p>
            The first global decentralized B2B network connecting heritage
            saree weavers with the global retail industry of 2070.
          </p>
          <div className="social-links" aria-label="Social media">
            <a href="https://www.instagram.com/" aria-label="Instagram">ig</a>
            <a href="https://www.linkedin.com/" aria-label="LinkedIn">in</a>
            <a href="https://x.com/" aria-label="X">x</a>
          </div>
        </div>
        <FooterColumn title="Account" links={footerColumns.account} />
        <FooterColumn title="Support" links={footerColumns.support} />
        <FooterColumn title="Marketplace" links={footerColumns.marketplace} />
        <FooterColumn title="Enterprise" links={footerColumns.enterprise} />
        <div className="network-status">
          <h3>Network Status</h3>
          <div className="status-panel">
            <p><span />All Systems Operational</p>
            <small>Quantum Node: Delta-9<br />Uptime: 99.998%<br />Last Block: #4,209,112</small>
          </div>
        </div>
      </div>
      <div className="footer-bottom content-width">
        <p>© Norosilk. All rights reserved.</p>
        <div>
          {footerColumns.legal.map((link) => (
            <a href={link.href} key={link.label}>{link.label}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}
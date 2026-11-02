import BrandLink from "@/components/ui/brand-link";
import FooterColumn from "@/components/layout/footer-column";
import { getFooterColumns } from "@/lib/site-content";
import { getCurrentTenant } from "@/lib/tenant/current";

const SOCIAL_LABELS = { instagram: "Instagram", linkedin: "LinkedIn", x: "X" } as const;

export default async function SiteFooter() {
  const tenant = await getCurrentTenant();
  const columns = getFooterColumns(tenant.salesMode);
  const blurb = tenant.branding.description || tenant.branding.tagline;
  const socials = Object.entries(SOCIAL_LABELS).filter(
    ([key]) => tenant.contact.social[key as keyof typeof SOCIAL_LABELS],
  );

  return (
    <footer className="site-footer">
      <div className="footer-grid content-width">
        <div className="footer-about">
          <BrandLink href="/" />
          {blurb ? <p>{blurb}</p> : null}
          {socials.length > 0 ? (
            <div className="social-links" aria-label="Social media">
              {socials.map(([key, label]) => (
                <a
                  key={key}
                  href={tenant.contact.social[key as keyof typeof SOCIAL_LABELS]}
                  aria-label={label}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {key === "instagram" ? "ig" : key === "linkedin" ? "in" : "x"}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <FooterColumn title="Shop" links={columns.shop} />
        <FooterColumn title="Account" links={columns.account} />
        <FooterColumn title="Help" links={columns.help} />
        <FooterColumn title="Company" links={columns.legal} />
      </div>
      <div className="footer-bottom content-width">
        <p>© {tenant.business.legalName}. All rights reserved.</p>
        {tenant.business.gstin ? <p>GSTIN: {tenant.business.gstin}</p> : null}
      </div>
    </footer>
  );
}

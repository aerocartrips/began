import Button from "@/components/ui/button";
import { siteContact } from "@/lib/site-content";

type EnterpriseSignupCardProps = {
  action?: string;
  id?: string;
};

export default function EnterpriseSignupCard({
  action = siteContact.email ? `mailto:${siteContact.email}` : "/contact",
  id = "enterprise",
}: EnterpriseSignupCardProps) {
  return (
    <div className="enterprise-panel" id={id}>
      <h3>Ready for Enterprise?</h3>
      <form action={action} method="get">
        <label htmlFor="corporate-email">Corporate Domain</label>
        <input
          id="corporate-email"
          name="email"
          type="email"
          placeholder="trade@yourcompany.com"
          required
        />
        <Button className="enterprise-submit" type="submit" variant="form">
          Request Partner Key
        </Button>
      </form>
    </div>
  );
}
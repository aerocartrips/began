import type { ReactNode } from "react";

type AccountHeadingProps = {
  title: string;
  lead?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
};

export default function AccountHeading({ title, lead, eyebrow = "Wholesale account", actions }: AccountHeadingProps) {
  return (
    <div className="commerce-heading account-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {lead ? <p className="account-lead">{lead}</p> : null}
      </div>
      {actions ? <div className="account-heading-actions">{actions}</div> : null}
    </div>
  );
}

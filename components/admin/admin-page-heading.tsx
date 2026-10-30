import type { ReactNode } from "react";

type AdminPageHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function AdminPageHeading({
  eyebrow,
  title,
  description,
  action,
}: AdminPageHeadingProps) {
  return (
    <header className="admin-page-heading">
      <div>
        {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
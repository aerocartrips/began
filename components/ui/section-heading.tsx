import type { ReactNode } from "react";

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export default function SectionHeading({
  title,
  subtitle,
  action,
  className = "",
  children,
}: SectionHeadingProps) {
  return (
    <div className={`section-heading ${className}`.trim()}>
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
      {action}
    </div>
  );
}
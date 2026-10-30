import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type TextLinkProps = {
  href?: ComponentProps<typeof Link>["href"];
  className?: string;
  icon?: ReactNode;
  children?: ReactNode;
};

export default function TextLink({
  href,
  className = "text-link",
  icon,
  children,
}: TextLinkProps) {
  const content = <>{children}{icon}</>;

  if (href !== undefined) return <Link className={className} href={href}>{content}</Link>;
  return <span className={className}>{content}</span>;
}
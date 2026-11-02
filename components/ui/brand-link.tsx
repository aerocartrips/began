"use client";

import Image from "next/image";
import Link from "next/link";
import { useTenant } from "@/features/tenant/tenant-provider";

type BrandLinkProps = {
  href?: string;
  className?: string;
};

/** Store logo, or its name as a wordmark when no logo is configured. */
export default function BrandLink({ href = "/", className = "wordmark" }: BrandLinkProps) {
  const { name, logoUrl } = useTenant();
  return (
    <Link className={className} href={href} aria-label={`${name} home`}>
      {logoUrl ? <Image src={logoUrl} alt={name} width={160} height={40} className="brand-logo" priority /> : name.toUpperCase()}
    </Link>
  );
}

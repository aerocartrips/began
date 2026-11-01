import Link from "next/link";

type BrandLinkProps = {
  href?: string;
  className?: string;
};

export default function BrandLink({ href = "/", className = "wordmark" }: BrandLinkProps) {
  return (
    <Link className={className} href={href} aria-label="Norosilk home">
      NOROSILK
    </Link>
  );
}
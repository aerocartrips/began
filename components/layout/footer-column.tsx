import Link from "next/link";

type FooterColumnProps = {
  title: string;
  links: readonly { label: string; href: string }[];
};

export default function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div className="footer-column">
      <h3>{title}</h3>
      <ul>
        {links.map((link) => (
          <li key={link.label}><Link href={link.href}>{link.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

type FooterColumnProps = {
  title: string;
  links: readonly { label: string; href: string }[];
};

/**
 * A footer link group. Wide screens show it as a column; phones as a
 * collapsed accordion row, so the footer is a few lines instead of a long list.
 * Each layout renders its own heading, so only the one on screen is announced.
 */
export default function FooterColumn({ title, links }: FooterColumnProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <div className="footer-column" data-open={open || undefined}>
      <h3>
        <span className="footer-column__title">{title}</span>
        <button
          type="button"
          className="footer-column__toggle"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
        >
          {title}
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </h3>
      <ul id={listId}>
        {links.map((link) => (
          <li key={link.label}><Link href={link.href}>{link.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

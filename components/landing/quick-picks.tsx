import Link from "next/link";
import type { QuickPickGroup } from "@/features/catalog/types";

/** One-tap filtered listings, grouped by fabric, weave, occasion and price. */
export default function QuickPicks({ groups }: { groups: QuickPickGroup[] }) {
  return (
    <div className="quick-picks">
      {groups.map((group) => (
        <div key={group.key} className="quick-picks__group">
          <h3>{group.title}</h3>
          <ul aria-label={group.title}>
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="quick-pick">
                  {link.label}
                  {link.count ? <span className="quick-pick__count">{link.count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

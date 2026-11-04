import { BadgeCheck, Boxes, FileText, RefreshCcw, ShieldCheck, Sparkles, Truck, type LucideIcon } from "lucide-react";
import type { HomeSection, TrustItem } from "@/features/homepage/types";
import { visibilityClass } from "@/components/landing/home-section";

const ICONS: Record<string, LucideIcon> = {
  boxes: Boxes,
  file: FileText,
  badge: BadgeCheck,
  truck: Truck,
  shield: ShieldCheck,
  sparkles: Sparkles,
  refresh: RefreshCcw,
};

/** Compact reasons to buy, one line each; scrolls sideways on small phones. */
export default function TrustStrip({ section, items, storeName }: { section: HomeSection; items: TrustItem[]; storeName: string }) {
  return (
    <section className={["trust-strip content-width", visibilityClass(section)].filter(Boolean).join(" ")} aria-label={`Why buy from ${storeName}`} data-home-section={section.key}>
      <ul>
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? BadgeCheck;
          return (
            <li key={item.title}>
              <Icon size={20} aria-hidden="true" />
              <span>
                <strong>{item.title}</strong>
                {item.text ? <small>{item.text}</small> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

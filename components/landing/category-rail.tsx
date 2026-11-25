import Image from "next/image";
import Link from "next/link";
import { buildClientDeliveryUrl } from "@/lib/cloudinary/transformations";
import type { CatalogImage } from "@/features/catalog/types";
import type { HomeSection } from "@/features/homepage/types";
import { visibilityClass } from "@/components/landing/home-section";

export type RailShortcut = { id: string; name: string; href: string; image: CatalogImage | null };

/**
 * Small round shortcuts directly under the header: the product types when the
 * store sells several, else its categories.
 */
export default function CategoryRail({ section, items, label }: { section: HomeSection; items: RailShortcut[]; label: string }) {
  return (
    <nav className={["category-rail", visibilityClass(section)].filter(Boolean).join(" ")} aria-label={label} data-home-section={section.key}>
      <ul className="category-rail__list content-width">
        {items.map((item) => {
          const src = item.image ? (item.image.publicId && buildClientDeliveryUrl(item.image.publicId, "thumbnail")) || item.image.url : "";
          return (
            <li key={item.id}>
              <Link href={item.href} className="category-rail__item">
                <span className="category-rail__image">
                  {src ? (
                    <Image src={src} alt="" width={50} height={50} sizes="50px" className="cover-image" />
                  ) : (
                    <span aria-hidden="true">{item.name.charAt(0)}</span>
                  )}
                </span>
                <span className="category-rail__name">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

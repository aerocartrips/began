import Image from "next/image";
import Link from "next/link";
import { buildClientDeliveryUrl } from "@/lib/cloudinary/transformations";
import type { CategoryOverview } from "@/features/catalog/types";
import type { HomeSection } from "@/features/homepage/types";
import { visibilityClass } from "@/components/landing/home-section";

/** Small round category shortcuts directly under the header. */
export default function CategoryRail({ section, categories }: { section: HomeSection; categories: CategoryOverview[] }) {
  return (
    <nav className={["category-rail", visibilityClass(section)].filter(Boolean).join(" ")} aria-label="Shop by category" data-home-section={section.key}>
      <ul className="category-rail__list content-width">
        {categories.map((category) => {
          const preview = category.previews[0];
          const src = category.imageUrl || (preview ? buildClientDeliveryUrl(preview.publicId ?? "", "thumbnail") || preview.url : "");
          return (
            <li key={category.id}>
              <Link href={`/categories/${category.slug}`} className="category-rail__item">
                <span className="category-rail__image">
                  {src ? (
                    <Image src={src} alt="" width={50} height={50} sizes="50px" className="cover-image" />
                  ) : (
                    <span aria-hidden="true">{category.name.charAt(0)}</span>
                  )}
                </span>
                <span className="category-rail__name">{category.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

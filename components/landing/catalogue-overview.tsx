import Image from "next/image";
import Link from "next/link";
import { buildClientDeliveryUrl } from "@/lib/cloudinary/transformations";
import { formatNumber, formatRupees } from "@/lib/format";
import CatalogueMore from "@/components/landing/catalogue-more";
import type { CategoryOverview } from "@/features/catalog/types";

/**
 * Every category on one screen: a 2×2 photo collage of its most popular
 * products, how many there are and the starting price. Lets shoppers see the
 * whole catalogue and jump straight to what they want.
 */
export default function CatalogueOverview({
  categories,
  salesMode,
}: {
  categories: CategoryOverview[];
  salesMode: "wholesale" | "retail";
}) {
  const listId = "catalogue-overview";
  return (
    <>
      <ul className="catalogue-overview" id={listId} data-expanded="false">
        {categories.map((category) => {
          const images = category.previews.length
            ? category.previews
            : category.imageUrl
              ? [{ url: category.imageUrl, alt: "" }]
              : [];
          return (
            <li key={category.id}>
              <Link href={`/categories/${category.slug}`} className="catalogue-tile">
                <span className="catalogue-tile__collage" data-count={Math.min(images.length, 4)}>
                  {images.slice(0, 4).map((image, index) => (
                    <span key={`${image.url}-${index}`}>
                      <Image
                        src={
                          ("publicId" in image &&
                            image.publicId &&
                            buildClientDeliveryUrl(image.publicId, "thumbnail")) ||
                          image.url
                        }
                        alt=""
                        fill
                        sizes="(max-width: 640px) 25vw, 12vw"
                        className="cover-image"
                      />
                    </span>
                  ))}
                </span>
                <span className="catalogue-tile__name">{category.name}</span>
                <span className="catalogue-tile__meta">
                  {formatNumber(category.productCount)}{" "}
                  {category.productCount === 1 ? "design" : "designs"}
                  {category.startingPrice > 0 ? (
                    <>
                      {" · from "}
                      {formatRupees(category.startingPrice)}
                      {salesMode === "wholesale" ? "/pc" : ""}
                    </>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <CatalogueMore listId={listId} total={categories.length} />
    </>
  );
}

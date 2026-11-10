import Skeleton from "@/components/ui/loaders/skeleton";

/**
 * Placeholder for components/catalog/product-card.tsx. It uses the card's own
 * classes, one bar per line (the name is always two lines tall; most sarees have
 * colour options, so the colours line is held too), so the placeholder and the
 * loaded card have the same height and loading doesn't shift the layout. Bars
 * sit in a span inside flex lines, so they get the line's height.
 */
export default function CatalogCardSkeleton() {
  return (
    <article className="catalog-card" aria-hidden="true">
      <div className="catalog-card__media">
        <Skeleton className="ui-image-skeleton" rounded="none" />
      </div>
      <div className="catalog-card__body">
        <p className="catalog-card__title">
          <Skeleton className="catalog-card__bone" />
          <Skeleton className="catalog-card__bone catalog-card__bone--short" />
        </p>
        <p className="catalog-card__sku">
          <Skeleton className="catalog-card__bone catalog-card__bone--short" />
        </p>
        <p className="catalog-price">
          <span>
            <Skeleton className="catalog-card__bone catalog-card__bone--price" />
          </span>
        </p>
        <p className="catalog-card__tier">
          <Skeleton className="catalog-card__bone" />
        </p>
        <p className="catalog-card__meta">
          <span>
            <Skeleton className="catalog-card__bone catalog-card__bone--short" />
          </span>
        </p>
        <div className="catalog-card__foot">
          <Skeleton className="catalog-card__bone catalog-card__bone--swatches" />
        </div>
      </div>
    </article>
  );
}

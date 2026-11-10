import Skeleton from "@/components/ui/loaders/skeleton";

function StepSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="checkout-step">
      <div className="checkout-step__head">
        <Skeleton className="checkout-step__number" rounded="pill" />
        <Skeleton className="ui-skeleton-line ui-skeleton-line--title" />
      </div>
      <div className="checkout-step__body">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className="ui-skeleton-line ui-skeleton-line--meta" />
        ))}
      </div>
    </div>
  );
}

/** Placeholder in checkout's own layout (steps and order summary), so the page lands without shifting. */
export default function CheckoutSkeleton() {
  return (
    <main className="commerce-page content-width checkout-page" aria-busy="true">
      <div className="commerce-heading checkout-heading">
        <div>
          <Skeleton className="ui-skeleton-line ui-skeleton-line--eyebrow" />
          <Skeleton className="ui-skeleton-line ui-skeleton-line--hero" />
        </div>
      </div>
      <div className="checkout-layout">
        <div className="checkout-form">
          <StepSkeleton />
          <StepSkeleton lines={4} />
          <StepSkeleton />
        </div>
        <div className="checkout-summary">
          <Skeleton className="ui-skeleton-panel ui-skeleton-cart-summary" rounded="card" />
        </div>
      </div>
      <span className="sr-only">Loading checkout</span>
    </main>
  );
}

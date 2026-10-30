export function ReviewListSkeleton() {
  return (
    <div className="review-skeleton" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="review-skeleton-card" />
      ))}
    </div>
  );
}

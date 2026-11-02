import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";

export default function StoreNotFound() {
  return (
    <main className="commerce-page content-width">
      <EmptyState
        title="Page not found"
        description="The page you are looking for has moved or no longer exists."
        action={<Link className="text-link" href="/products">Browse the catalogue</Link>}
      />
    </main>
  );
}

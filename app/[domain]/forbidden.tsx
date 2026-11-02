import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";

/** Rendered by forbidden(), e.g. when an admin's role lacks a permission. */
export default function Forbidden() {
  return (
    <main className="commerce-page content-width">
      <EmptyState
        title="You don't have access to this page"
        description="Your account role does not include this section. Ask the store owner if you need access."
        action={<Link className="text-link" href="/admin">Back to dashboard</Link>}
      />
    </main>
  );
}

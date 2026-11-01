"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import RatingStars from "@/components/reviews/rating-stars";
import { useApiRequest } from "@/hooks/use-api-request";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { deleteReviewAdmin, moderateReviewAdmin } from "@/features/reviews/review-api";
import type { PublicReview } from "@/features/reviews/types";
import { formatDate } from "@/lib/format";

const FILTERS = [
  { id: "", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

type BusyState = { id: string; action: "approved" | "rejected" | "delete" } | null;

export default function AdminReviewsClient() {
  const feedback = useFeedback();
  const [moderationStatus, setModerationStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [busy, setBusy] = useState<BusyState>(null);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ limit: "30" });
    if (moderationStatus) params.set("moderationStatus", moderationStatus);
    if (appliedSearch.trim()) params.set("q", appliedSearch.trim());
    return `/api/v1/admin/reviews?${params.toString()}`;
  }, [moderationStatus, appliedSearch]);

  const listRequest = useApiRequest<PublicReview[]>(endpoint);
  const reviews = listRequest.data ?? [];

  async function moderate(reviewId: string, status: "approved" | "rejected") {
    setBusy({ id: reviewId, action: status });
    try {
      await moderateReviewAdmin(reviewId, status);
      feedback.success("Review updated", status === "approved" ? "Review is now public." : "Review rejected.");
      await listRequest.refetch();
    } catch (error) {
      feedback.error("Moderation failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(reviewId: string) {
    if (!window.confirm("Delete this review permanently?")) return;
    setBusy({ id: reviewId, action: "delete" });
    try {
      await deleteReviewAdmin(reviewId);
      feedback.success("Review deleted", "The review was removed.");
      await listRequest.refetch();
    } catch (error) {
      feedback.error("Delete failed", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    if (search === appliedSearch) void listRequest.refetch();
    else setAppliedSearch(search);
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalog quality"
        title="Product reviews"
        description="Moderate verified purchase reviews before they appear on product pages."
      />

      <div className="admin-tabs" role="tablist" aria-label="Moderation status">
        {FILTERS.map((filter) => (
          <button
            key={filter.id || "all"}
            type="button"
            role="tab"
            aria-selected={moderationStatus === filter.id}
            className={moderationStatus === filter.id ? "is-active" : undefined}
            onClick={() => setModerationStatus(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <form className="admin-toolbar" onSubmit={applySearch} role="search">
        <label className="admin-toolbar__search">
          <span className="sr-only">Search reviews</span>
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search product, customer, or review text…"
          />
        </label>
        <LoadingButton type="submit" variant="secondary" loading={listRequest.loading}>
          Apply
        </LoadingButton>
      </form>

      {listRequest.error ? (
        <ErrorCard
          title="Unable to load reviews"
          description={listRequest.error}
          action={<LoadingButton type="button" onClick={() => void listRequest.refetch()}>Try again</LoadingButton>}
        />
      ) : listRequest.loading && reviews.length === 0 ? (
        <TableSkeleton rows={6} />
      ) : reviews.length === 0 ? (
        <div className="admin-empty-results" role="status">
          {moderationStatus === "pending" ? "No reviews are waiting for moderation." : "No reviews match these filters."}
        </div>
      ) : (
        <div className="admin-review-list">
          {reviews.map((review) => {
            const status = review.moderationStatus ?? "pending";
            const isBusy = busy?.id === review._id;
            return (
              <article className="admin-review-card" key={review._id}>
                <header className="admin-review-card__head">
                  <div className="admin-cell-stack">
                    <strong>{review.productName ?? "Product"}</strong>
                    <small>
                      {review.customerName}
                      {review.customerEmail ? ` · ${review.customerEmail}` : ""}
                      {review.createdAt ? ` · ${formatDate(review.createdAt)}` : ""}
                    </small>
                  </div>
                  <AdminStatusChip status={status} />
                </header>

                <div className="admin-review-card__body">
                  <RatingStars value={review.rating} size="sm" />
                  {review.title ? <h3>{review.title}</h3> : null}
                  <p>{review.comment}</p>
                  {review.images?.length ? (
                    <div className="admin-review-photos">
                      {review.images.map((image) => (
                        <a key={image._id} href={image.url} target="_blank" rel="noreferrer">
                          <Image src={image.thumbnailUrl || image.url} alt="Review photo" width={56} height={72} unoptimized />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>

                <footer className="admin-review-card__foot">
                  {review.orderNumber ? (
                    <Link className="admin-text-link" href={`/admin/orders/${review.orderId}`}>
                      Order {review.orderNumber}
                    </Link>
                  ) : <span />}
                  <div className="admin-review-actions">
                    <LoadingButton
                      type="button"
                      variant="destructive"
                      className="is-quiet"
                      loading={isBusy && busy?.action === "delete"}
                      disabled={isBusy}
                      onClick={() => void remove(review._id)}
                    >
                      Delete
                    </LoadingButton>
                    {status !== "rejected" ? (
                      <LoadingButton
                        type="button"
                        variant="secondary"
                        loading={isBusy && busy?.action === "rejected"}
                        disabled={isBusy}
                        onClick={() => void moderate(review._id, "rejected")}
                      >
                        Reject
                      </LoadingButton>
                    ) : null}
                    {status !== "approved" ? (
                      <LoadingButton
                        type="button"
                        loading={isBusy && busy?.action === "approved"}
                        disabled={isBusy}
                        onClick={() => void moderate(review._id, "approved")}
                      >
                        Approve
                      </LoadingButton>
                    ) : null}
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

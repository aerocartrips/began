type ReviewStatusBadgeProps = {
  status: "pending" | "approved" | "rejected";
};

const LABELS = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

export default function ReviewStatusBadge({ status }: ReviewStatusBadgeProps) {
  return <span className={`review-status-badge review-status-${status}`}>{LABELS[status]}</span>;
}

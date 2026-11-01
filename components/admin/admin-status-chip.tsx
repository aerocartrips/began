import { humanizeStatus } from "@/lib/format";

export type ChipTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<string, ChipTone> = {
  active: "success",
  approved: "success",
  captured: "success",
  completed: "success",
  configured: "success",
  delivered: "success",
  ok: "success",
  paid: "success",
  published: "success",
  resolved: "success",
  success: "success",
  succeeded: "success",
  pending: "warning",
  pending_payment: "warning",
  requested: "warning",
  under_review: "warning",
  refund_pending: "warning",
  waiting_customer: "warning",
  return_requested: "warning",
  partially_refunded: "warning",
  running: "info",
  open: "info",
  in_progress: "info",
  confirmed: "info",
  processing: "info",
  packed: "info",
  shipped: "info",
  out_for_delivery: "info",
  created: "info",
  cancelled: "danger",
  error: "danger",
  failed: "danger",
  rejected: "danger",
  suspended: "danger",
  missing: "danger",
};

export function chipToneFor(status: string | null | undefined): ChipTone {
  return TONES[String(status ?? "").toLowerCase()] ?? "neutral";
}

type AdminStatusChipProps = {
  status: string | null | undefined;
  label?: string;
  tone?: ChipTone;
};

export default function AdminStatusChip({ status, label, tone }: AdminStatusChipProps) {
  const resolvedTone = tone ?? chipToneFor(status);
  return <span className={`admin-chip is-${resolvedTone}`}>{label ?? humanizeStatus(status)}</span>;
}

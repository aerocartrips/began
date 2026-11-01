const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactRupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-IN");

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Formats a rupee amount (not paise). */
export function formatRupees(amount: number | null | undefined, { compact = false } = {}) {
  const value = Number(amount ?? 0);
  return (compact ? compactRupeeFormatter : rupeeFormatter).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number | null | undefined) {
  return numberFormatter.format(Number(value ?? 0));
}

function toDate(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | number | Date | null | undefined, fallback = "—") {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : fallback;
}

export function formatDateTime(value: string | number | Date | null | undefined, fallback = "—") {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : fallback;
}

/** "out_for_delivery" -> "Out for delivery" */
export function humanizeStatus(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  const text = value.replaceAll("_", " ").replaceAll("-", " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const relativeFormatter = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
const shortDateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

/** "Just now", "5 min ago", "Yesterday", then a short date. */
export function formatRelativeTime(value: string | number | Date | null | undefined, now = Date.now(), fallback = "") {
  const date = toDate(value);
  if (!date) return fallback;
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "Just now";
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relativeFormatter.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86400) return relativeFormatter.format(Math.round(seconds / 86400), "day");
  return shortDateFormatter.format(date);
}

export function formatTime(value: string | number | Date | null | undefined, fallback = "") {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : fallback;
}

/** Label for a chat date separator: "Today", "Yesterday" or a full date. */
export function formatDayLabel(value: string | number | Date | null | undefined, now = new Date()) {
  const date = toDate(value);
  if (!date) return "";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return dateFormatter.format(date);
}

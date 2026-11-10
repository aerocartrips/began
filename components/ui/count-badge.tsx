import { formatNumber } from "@/lib/format";

/** The badge text for `count`: null at zero, "99+" above `max`. */
export function badgeCount(count: number | null | undefined, max = 99) {
  if (!count || count < 1) return null;
  return count > max ? `${formatNumber(max)}+` : formatNumber(count);
}

type CountBadgeProps = {
  count: number | null | undefined;
  /** Pinned to the top-right corner of its positioned parent (an icon button, a product photo). */
  corner?: boolean;
  /**
   * What the number counts, for screen readers (", 3 unread"). Omit it when
   * the parent's label or nearby text already says the number.
   */
  label?: string;
  /** Shown as "99+" above this; quantities pass Infinity to show the exact number. */
  max?: number;
};

/**
 * The store's one count badge: cart, notifications, applied filters, unread
 * messages and line quantities all use it, on a corner or inline beside a
 * label. Renders nothing at zero.
 */
export default function CountBadge({ count, corner = false, label, max = 99 }: CountBadgeProps) {
  const text = badgeCount(count, max);
  if (!text) return null;
  return (
    <>
      <span className={corner ? "count-badge count-badge--corner" : "count-badge"} aria-hidden="true">
        {text}
      </span>
      {label ? <span className="sr-only">{`, ${text} ${label}`}</span> : null}
    </>
  );
}

"use client";

import { useSyncExternalStore } from "react";

const DISPLAY_TIME: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
};

const formatter = new Intl.DateTimeFormat("en-IN", DISPLAY_TIME);

type ClientFormattedTimeProps = {
  value: string | number | Date;
  className?: string;
};

function toIso(value: string | number | Date) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return String(value);
}

function formatIso(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : formatter.format(parsed);
}

const subscribeNoop = () => () => {};

/** False during SSR and hydration, true afterwards — avoids hydration mismatches. */
export function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/** Renders a locale-aware timestamp after mount to avoid SSR/client hydration mismatches. */
export default function ClientFormattedTime({ value, className }: ClientFormattedTimeProps) {
  const iso = toIso(value);
  const label = useIsClient() ? formatIso(iso) : "";

  return (
    <time className={className} dateTime={iso}>
      {label || "…"}
    </time>
  );
}

/**
 * Same formatting for inline text (not wrapped in `<time>`).
 */
export function useClientFormattedTime(value: string | number | Date) {
  const label = useIsClient() ? formatIso(toIso(value)) : "";
  return label || "…";
}

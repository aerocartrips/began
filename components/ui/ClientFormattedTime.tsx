"use client";

import { useEffect, useState } from "react";

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

type ClientFormattedTimeProps = {
  value: string | number | Date;
  className?: string;
};

/** Renders a locale-aware timestamp after mount to avoid SSR/client hydration mismatches. */
export default function ClientFormattedTime({ value, className }: ClientFormattedTimeProps) {
  const iso =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "number"
        ? new Date(value).toISOString()
        : String(value);

  const [label, setLabel] = useState("");

  useEffect(() => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      setLabel("");
      return;
    }
    setLabel(new Intl.DateTimeFormat("en-IN", DISPLAY_TIME).format(parsed));
  }, [iso]);

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
  const iso =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "number"
        ? new Date(value).toISOString()
        : String(value);

  const [label, setLabel] = useState("");

  useEffect(() => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      setLabel("");
      return;
    }
    setLabel(new Intl.DateTimeFormat("en-IN", DISPLAY_TIME).format(parsed));
  }, [iso]);

  return label || "…";
}

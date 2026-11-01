import type { ReactNode } from "react";

const sizeClass = {
  sm: "ui-spinner--sm",
  md: "ui-spinner--md",
  lg: "ui-spinner--lg",
} as const;

type SpinnerProps = {
  size?: keyof typeof sizeClass;
  label?: string;
  className?: string;
};

export default function Spinner({ size = "md", label = "Loading", className }: SpinnerProps) {
  return (
    <span
      className={["ui-spinner", sizeClass[size], className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="ui-spinner__ring" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

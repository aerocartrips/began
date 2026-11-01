import type { ButtonHTMLAttributes, ReactNode } from "react";
import ButtonLoader from "@/components/ui/loaders/button-loader";

const variantClass = {
  primary: "button button-primary",
  secondary: "button button-glass",
  outline: "button ui-loading-button--outline",
  destructive: "button ui-loading-button--destructive",
  portal: "portal-button",
  batch: "batch-action",
  form: "",
} as const;

type LoadingButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  loading?: boolean;
  loadingText?: string;
  variant?: keyof typeof variantClass;
  /** "sm" is the compact size used inside cards, toolbars, and admin views. */
  size?: "md" | "sm";
  icon?: ReactNode;
  children: ReactNode;
};

export default function LoadingButton({
  loading = false,
  loadingText,
  disabled,
  variant = "primary",
  size = "md",
  className,
  children,
  icon,
  type = "button",
  ...buttonProps
}: LoadingButtonProps) {
  const visibleLabel = loading ? loadingText ?? children : children;
  const classes = [variantClass[variant], "ui-loading-button", size === "sm" && "button-sm", className].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading}
      {...buttonProps}
    >
      <span className="ui-loading-button__content">
        {loading ? <ButtonLoader label={loadingText ?? "Processing"} /> : icon}
        <span className={loading ? "ui-loading-button__label is-loading" : "ui-loading-button__label"}>
          {visibleLabel}
        </span>
      </span>
    </button>
  );
}

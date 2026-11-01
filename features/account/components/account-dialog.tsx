"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type AccountDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** Blocks Escape/backdrop dismissal while a request is in flight. */
  busy?: boolean;
  tone?: "default" | "danger";
  size?: "sm" | "md";
  children?: ReactNode;
  footer?: ReactNode;
};

/**
 * Modal built on the native <dialog>, which provides focus trapping, Escape
 * handling and inert background content without extra JavaScript.
 */
export default function AccountDialog({
  open,
  title,
  description,
  onClose,
  busy = false,
  tone = "default",
  size = "md",
  children,
  footer,
}: AccountDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`account-dialog account-dialog--${size}${tone === "danger" ? " is-danger" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      {open ? (
        <div className="account-dialog-body">
          <header className="account-dialog-head">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description ? <p id={descriptionId}>{description}</p> : null}
            </div>
            <button type="button" className="account-icon-button" onClick={onClose} disabled={busy} aria-label="Close dialog">
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          {children}
          {footer ? <footer className="account-dialog-foot">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

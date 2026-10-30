"use client";

import { X } from "lucide-react";
import { useFeedback } from "@/components/feedback/FeedbackProvider";

export default function FeedbackContainer() {
  const { toasts, dismissToast } = useFeedback();

  if (toasts.length === 0) return null;

  return (
    <div className="ui-toast-stack" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={`ui-toast ui-toast--${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <div className="ui-toast__content">
            <strong>{toast.title}</strong>
            {toast.description ? <p>{toast.description}</p> : null}
            {toast.actionLabel && toast.onAction ? (
              <button type="button" className="ui-toast__action" onClick={toast.onAction}>
                {toast.actionLabel}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="ui-toast__close"
            aria-label="Dismiss notification"
            onClick={() => dismissToast(toast.id)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </article>
      ))}
    </div>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
};

type PushToastInput = {
  type: ToastType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  dedupeKey?: string;
};

type FeedbackContextValue = {
  pushToast: (toast: PushToastInput) => string;
  dismissToast: (id: string) => void;
  success: (title: string, description?: string, dedupeKey?: string) => void;
  error: (title: string, description?: string, dedupeKey?: string) => void;
  warning: (title: string, description?: string, dedupeKey?: string) => void;
  info: (title: string, description?: string, dedupeKey?: string) => void;
  toasts: ToastItem[];
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function createToastId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dedupeRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({
      type,
      title,
      description,
      actionLabel,
      onAction,
      durationMs = 4200,
      dedupeKey,
    }: PushToastInput) => {
      if (dedupeKey) {
        const lastShown = dedupeRef.current.get(dedupeKey) ?? 0;
        if (Date.now() - lastShown < 1500) {
          return "";
        }
        dedupeRef.current.set(dedupeKey, Date.now());
      }

      const id = createToastId();
      const toast: ToastItem = {
        id,
        type,
        title,
        description,
        actionLabel,
        onAction,
        durationMs,
      };

      setToasts((current) => [...current.slice(-4), toast]);

      if (durationMs > 0) {
        window.setTimeout(() => dismissToast(id), durationMs);
      }

      return id;
    },
    [dismissToast],
  );

  const value = useMemo<FeedbackContextValue>(
    () => ({
      toasts,
      pushToast,
      dismissToast,
      success: (title, description, dedupeKey) =>
        pushToast({ type: "success", title, description, dedupeKey }),
      error: (title, description, dedupeKey) =>
        pushToast({ type: "error", title, description, dedupeKey }),
      warning: (title, description, dedupeKey) =>
        pushToast({ type: "warning", title, description, dedupeKey }),
      info: (title, description, dedupeKey) =>
        pushToast({ type: "info", title, description, dedupeKey }),
    }),
    [dismissToast, pushToast, toasts],
  );

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider.");
  }
  return context;
}

export function useOptionalFeedback() {
  return useContext(FeedbackContext);
}

"use client";

import { useCallback, useRef, useState } from "react";
import { normalizeClientApiError } from "@/lib/api/api-error";

type AsyncActionState<T> = {
  loading: boolean;
  error: string;
  data: T | null;
};

type UseAsyncActionOptions = {
  /** Prevent overlapping runs of the same action. */
  guardDuplicates?: boolean;
};

export function createAsyncActionGuard() {
  let inFlight = false;
  return {
    tryBegin() {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    end() {
      inFlight = false;
    },
    get inFlight() {
      return inFlight;
    },
  };
}

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: UseAsyncActionOptions = {},
) {
  const { guardDuplicates = true } = options;
  const guardRef = useRef(false);
  const [state, setState] = useState<AsyncActionState<TResult>>({
    loading: false,
    error: "",
    data: null,
  });

  const reset = useCallback(() => {
    setState({ loading: false, error: "", data: null });
  }, []);

  const run = useCallback(
    async (...args: TArgs) => {
      if (guardDuplicates && guardRef.current) {
        return { ok: false as const, skipped: true as const };
      }

      if (guardDuplicates) guardRef.current = true;
      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const data = await action(...args);
        setState({ loading: false, error: "", data });
        return { ok: true as const, data, skipped: false as const };
      } catch (error) {
        const normalized = normalizeClientApiError(error);
        setState({ loading: false, error: normalized.message, data: null });
        return { ok: false as const, error: normalized, skipped: false as const };
      } finally {
        if (guardDuplicates) guardRef.current = false;
      }
    },
    [action, guardDuplicates],
  );

  return { ...state, run, reset };
}

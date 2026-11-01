"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/api-client";
import { normalizeClientApiError } from "@/lib/api/api-error";

type UseApiRequestOptions = {
  immediate?: boolean;
  enabled?: boolean;
};

type ApiRequestState<T> = {
  loading: boolean;
  error: string;
  data: T | null;
  fieldErrors: { field: string; message: string }[];
  meta: Record<string, unknown> | null;
};

export function useApiRequest<T>(
  input: string | null,
  requestOptions: Parameters<typeof apiRequest>[1] = {},
  hookOptions: UseApiRequestOptions = {},
) {
  const { immediate = true, enabled = true } = hookOptions;
  const abortRef = useRef<AbortController | null>(null);
  const requestOptionsRef = useRef(requestOptions);
  useEffect(() => {
    requestOptionsRef.current = requestOptions;
  }, [requestOptions]);
  const [state, setState] = useState<ApiRequestState<T>>({
    loading: Boolean(immediate && enabled && input),
    error: "",
    data: null,
    fieldErrors: [],
    meta: null,
  });

  const execute = useCallback(async () => {
    if (!input || !enabled) {
      setState((current) => ({ ...current, loading: false }));
      return { ok: false as const };
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((current) => ({
      ...current,
      loading: true,
      error: "",
      fieldErrors: [],
    }));

    try {
      const result = await apiRequest<T>(input, {
        ...requestOptionsRef.current,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return { ok: false as const, aborted: true as const };
      setState({
        loading: false,
        error: "",
        data: result.data,
        fieldErrors: [],
        meta: (result.meta as Record<string, unknown> | null) ?? null,
      });
      return { ok: true as const, data: result.data, meta: result.meta };
    } catch (error) {
      if (controller.signal.aborted) return { ok: false as const, aborted: true as const };
      const normalized = normalizeClientApiError(error);
      setState({
        loading: false,
        error: normalized.message,
        data: null,
        fieldErrors: normalized.errors,
        meta: null,
      });
      return { ok: false as const, error: normalized };
    }
  }, [enabled, input]);

  useEffect(() => {
    if (!immediate || !enabled) return undefined;
    void execute(); // eslint-disable-line react-hooks/set-state-in-effect -- initial query fetch
    return () => abortRef.current?.abort();
  }, [enabled, execute, immediate]);

  return { ...state, refetch: execute };
}

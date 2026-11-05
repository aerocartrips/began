declare module "@/lib/api/api-client" {
  export type ApiResult<T> = {
    ok: boolean;
    status: number;
    data: T | null;
    meta?: Record<string, unknown> | null;
    message: string;
    errors: { field: string; message: string }[];
    response: Response;
  };

  export function apiRequest<T>(
    input: string,
    options?: Record<string, unknown>,
  ): Promise<ApiResult<T>>;

  /** `fetch` that refreshes an expired customer session once and repeats the request. */
  export function fetchWithSession(input: string, init?: RequestInit): Promise<Response>;

  /** Renews the customer session from its refresh cookie (shared across concurrent callers). */
  export function refreshSession(): Promise<boolean>;
}

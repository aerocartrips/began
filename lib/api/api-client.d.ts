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
}

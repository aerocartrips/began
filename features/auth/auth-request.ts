export type AuthResponse<T = unknown> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: { field: string; message: string }[];
};

/**
 * POSTs a public account form (sign in, register, password reset) as JSON.
 * Never throws: network failures come back as a failed result with a message.
 */
export async function postAuthForm<T = unknown>(endpoint: string, body: unknown): Promise<{ ok: boolean; result: AuthResponse<T> }> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as AuthResponse<T>;
    return { ok: response.ok && Boolean(result.success), result };
  } catch {
    return { ok: false, result: { message: "Unable to reach the server. Check your connection and try again." } };
  }
}

/** The message to show for a failed form: the first field error, else the response message. */
export function authErrorMessage(result: AuthResponse, fallback: string) {
  return result.errors?.[0]?.message ?? result.message ?? fallback;
}

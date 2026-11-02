import { ApiError } from "@/lib/utils/api-error";
import {
  getDelhiveryB2BApiBaseUrl,
  getDelhiveryB2BCredentials,
  getDelhiveryB2BUmsLoginUrl,
} from "@/lib/delhivery/b2b-config";

/** Auth tokens per Delhivery account (stores may use different accounts). */
const tokens = new Map();

function extractToken(payload) {
  if (!payload || typeof payload !== "object") return null;
  return (
    payload.token ??
    payload.access_token ??
    payload.jwt ??
    payload.data?.token ??
    payload.data?.access_token ??
    null
  );
}

export async function getDelhiveryB2BAuthToken({ forceRefresh = false } = {}) {
  const { username, password } = await getDelhiveryB2BCredentials();
  if (!username || !password) {
    throw new ApiError(503, "Delhivery B2B credentials are not configured.");
  }

  const cached = tokens.get(username);
  if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const loginUrl = getDelhiveryB2BUmsLoginUrl();

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(502, "Delhivery B2B login returned invalid JSON.");
  }

  if (!response.ok) {
    throw new ApiError(502, "Delhivery B2B authentication failed.", [
      { field: "delhivery", message: payload?.message ?? `HTTP ${response.status}` },
    ]);
  }

  const token = extractToken(payload);
  if (!token) {
    throw new ApiError(502, "Delhivery B2B login response did not include a token.");
  }

  tokens.set(username, { token, expiresAt: Date.now() + 50 * 60 * 1000 });
  return token;
}

export async function delhiveryB2BRequest(path, { method = "POST", body } = {}) {
  const token = await getDelhiveryB2BAuthToken();
  const url = `${getDelhiveryB2BApiBaseUrl().replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 500) };
  }

  return { ok: response.ok, status: response.status, payload };
}

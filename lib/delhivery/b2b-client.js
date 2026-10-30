import { ApiError } from "@/lib/utils/api-error";
import {
  getDelhiveryB2BApiBaseUrl,
  getDelhiveryB2BUmsLoginUrl,
  isDelhiveryB2BConfigured,
} from "@/lib/delhivery/b2b-config";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

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
  if (!isDelhiveryB2BConfigured()) {
    throw new ApiError(503, "Delhivery B2B credentials are not configured.");
  }

  if (!forceRefresh && cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const username = process.env.DELHIVERY_B2B_USERNAME.trim();
  const password = process.env.DELHIVERY_B2B_PASSWORD.trim();
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

  cachedToken = token;
  cachedTokenExpiresAt = Date.now() + 50 * 60 * 1000;
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

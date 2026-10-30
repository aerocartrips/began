export function isDelhiveryConfigured() {
  return Boolean(process.env.DELHIVERY_API_TOKEN?.trim());
}

export function getDelhiveryApiBaseUrl() {
  return process.env.DELHIVERY_API_BASE_URL?.trim() || "https://track.delhivery.com";
}

export function getDelhiveryApiToken() {
  const token = process.env.DELHIVERY_API_TOKEN?.trim();
  if (!token) return null;
  return token;
}

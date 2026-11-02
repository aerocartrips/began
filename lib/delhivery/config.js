import { getCurrentIntegrations } from "@/lib/tenant/integrations";

/** Delhivery API host is platform-wide; the token belongs to the current store. */
export function getDelhiveryApiBaseUrl() {
  return process.env.DELHIVERY_API_BASE_URL?.trim() || "https://track.delhivery.com";
}

export async function getDelhiveryApiToken() {
  return (await getCurrentIntegrations()).delhivery.apiToken || null;
}

export async function isDelhiveryConfigured() {
  return Boolean(await getDelhiveryApiToken());
}

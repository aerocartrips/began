import { getCurrentIntegrations } from "@/lib/tenant/integrations";

/** Current store's Delhivery B2B login (Tenant.integrations.delhivery). */
export async function getDelhiveryB2BCredentials() {
  const { delhivery } = await getCurrentIntegrations();
  return { username: delhivery.b2bUsername, password: delhivery.b2bPassword };
}

export async function isDelhiveryB2BConfigured() {
  const { username, password } = await getDelhiveryB2BCredentials();
  return Boolean(username && password && getDelhiveryB2BBookingPath());
}

export function getDelhiveryB2BUmsLoginUrl() {
  return (
    process.env.DELHIVERY_B2B_UMS_LOGIN_URL?.trim() ||
    "https://ltl-clients-api.delhivery.com/ums/login"
  );
}

export function getDelhiveryB2BApiBaseUrl() {
  return process.env.DELHIVERY_B2B_API_BASE_URL?.trim() || "https://btob.api.delhivery.com";
}

export function getDelhiveryB2BBookingPath() {
  return process.env.DELHIVERY_B2B_BOOKING_PATH?.trim() || "";
}

export function getDelhiveryB2BManifestPath() {
  return process.env.DELHIVERY_B2B_MANIFEST_PATH?.trim() || "";
}

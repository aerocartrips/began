export function isDelhiveryB2BConfigured() {
  return Boolean(
    process.env.DELHIVERY_B2B_USERNAME?.trim() &&
      process.env.DELHIVERY_B2B_PASSWORD?.trim() &&
      process.env.DELHIVERY_B2B_BOOKING_PATH?.trim(),
  );
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

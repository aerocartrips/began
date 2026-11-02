import { ApiError } from "@/lib/utils/api-error";
import { getDelhiveryApiBaseUrl, getDelhiveryApiToken } from "@/lib/delhivery/config";

const CACHE_MS = Number(process.env.DELHIVERY_TRACKING_CACHE_MS ?? 5 * 60 * 1000);

/**
 * @param {string} awb
 * @param {{ fetchedAt?: Date, cache?: unknown }} [cached]
 */
export async function fetchDelhiveryTracking(awb, cached) {
  if (!awb?.trim()) {
    throw new ApiError(404, "Tracking number is not available for this shipment.");
  }

  if (
    cached?.fetchedAt &&
    cached.cache &&
    Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_MS
  ) {
    return { ...cached.cache, cached: true };
  }

  const token = await getDelhiveryApiToken();
  if (!token) {
    throw new ApiError(503, "Shipment tracking is not configured.");
  }

  const url = new URL("/api/v1/packages/json/", getDelhiveryApiBaseUrl());
  url.searchParams.set("waybill", awb.trim());
  url.searchParams.set("token", token);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(502, "Unable to fetch tracking information right now.");
  }

  const payload = await response.json();
  const shipmentData = Array.isArray(payload?.ShipmentData) ? payload.ShipmentData[0] : null;
  const shipment = shipmentData?.Shipment ?? null;
  const scans = Array.isArray(shipment?.Scans) ? shipment.Scans : [];

  const events = scans
    .map((entry) => {
      const detail = entry?.ScanDetail ?? entry;
      return {
        status: detail?.Scan ?? detail?.Status ?? "",
        location: detail?.ScannedLocation ?? detail?.Location ?? "",
        remarks: detail?.Instructions ?? detail?.StatusCode ?? "",
        at: detail?.ScanDateTime ?? detail?.StatusDateTime ?? null,
      };
    })
    .filter((event) => event.status);

  const normalized = {
    awb: awb.trim(),
    carrier: "Delhivery",
    status: shipment?.Status?.Status ?? shipment?.Status ?? "",
    estimatedDelivery: shipment?.ExpectedDeliveryDate ?? null,
    events,
    rawStatus: shipment?.Status ?? null,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };

  return normalized;
}

export { CACHE_MS as DELHIVERY_TRACKING_CACHE_MS };

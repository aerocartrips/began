/**
 * Cheap checks that keep crawlers, scripts and cross-site requests out of
 * popularity counts. They are not a security boundary (headers can be forged),
 * which is why counted events are also de-duplicated and capped per client
 * (lib/services/product-activity.service.js).
 */

const AUTOMATED_AGENT =
  /bot|crawl|spider|slurp|scrap|preview|facebookexternalhit|embedly|headless|lighthouse|pagespeed|pingdom|uptime|monitor|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|postman|insomnia/i;

/**
 * @param {Headers} headers
 * @returns {boolean} true when the request should not count as shopper interest
 */
export function isAutomatedRequest(headers) {
  const agent = headers.get("user-agent") ?? "";
  if (agent.length < 20 || AUTOMATED_AGENT.test(agent)) return true;
  // Prefetches and prerenders are not views.
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("prerender")) return true;
  // Browsers mark fetches from our own pages as same-origin; anything else did not come from the storefront.
  const site = headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin";
}

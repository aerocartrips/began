/** "GST (5%)" for one rate, "GST (5%, 12%)" for several. */
export function gstLabel(rates: number[] | undefined) {
  return rates?.length ? `GST (${rates.map((rate) => `${rate}%`).join(", ")})` : "GST";
}

/** "piece"/"pieces" in wholesale stores, "item"/"items" in retail ones. */
export function unitLabel(salesMode: "wholesale" | "retail", count: number) {
  const unit = salesMode === "wholesale" ? "piece" : "item";
  return count === 1 ? unit : `${unit}s`;
}

import { ORDER_FILTER_BUCKETS } from "@/lib/constants/order-status";
import { orderRepository } from "@/lib/repositories/order.repository";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";

function parseListQuery(searchParams) {
  const bucket = searchParams.get("bucket") ?? undefined;
  const orderStatus =
    searchParams.get("orderStatus") ??
    (bucket && bucket !== "all" ? ORDER_FILTER_BUCKETS[bucket] : undefined) ??
    undefined;
  const paymentStatus = searchParams.get("paymentStatus") ?? undefined;
  if (bucket === "pending_payment" && !paymentStatus) {
    return {
      orderStatus: ORDER_FILTER_BUCKETS.pending_payment,
      paymentStatus: "pending",
      q: searchParams.get("q") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      sort: searchParams.get("sort") === "asc" ? "asc" : "desc",
    };
  }

  return {
    orderStatus: orderStatus || undefined,
    paymentStatus: paymentStatus || undefined,
    q: searchParams.get("q") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    sort: searchParams.get("sort") === "asc" ? "asc" : "desc",
  };
}

export async function listOrdersQuery(user, searchParams, isAdmin) {
  const { page, limit, skip } = parsePagination(searchParams);
  const filters = parseListQuery(searchParams);
  const result = await orderRepository.listFiltered({
    customerId: isAdmin ? null : user?._id,
    skip,
    limit,
    ...filters,
  });

  return {
    items: result.items,
    meta: buildPaginationMeta(result.total, page, limit),
    filters,
  };
}

export async function getOrderSummary(user, isAdmin) {
  return orderRepository.aggregateSummary(isAdmin ? null : user?._id);
}

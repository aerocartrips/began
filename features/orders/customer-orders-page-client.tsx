"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import EmptyState from "@/components/ui/empty-state";
import ErrorCard from "@/components/ui/feedback/ErrorCard";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import DownloadInvoiceButton from "@/components/orders/download-invoice-button";
import { OrderListSkeleton } from "@/components/ui/loaders/OrderListSkeleton";
import OrderProductReviewAction from "@/components/reviews/OrderProductReviewAction";
import { fetchCustomerOrders, fetchOrderSummary } from "@/features/orders/order-api";
import OrderStatusBadge from "@/features/orders/order-status-badge";
import type { OrderListItem, OrderSummaryStats } from "@/features/orders/types";
import { fetchOrderReviewContext } from "@/features/reviews/review-api";
import type { OrderReviewContextMap } from "@/features/reviews/types";
import { fetchCurrentCustomer } from "@/features/checkout/submit-checkout-order";

const FILTER_OPTIONS = [
  { id: "all", label: "All orders" },
  { id: "pending_payment", label: "Pending payment" },
  { id: "confirmed", label: "Confirmed" },
  { id: "processing", label: "Processing" },
  { id: "packed", label: "Packed" },
  { id: "shipped", label: "Shipped" },
  { id: "out_for_delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "returned", label: "Returned" },
];

function mergeOrders(current: OrderListItem[], incoming: OrderListItem[]) {
  const map = new Map<string, OrderListItem>();
  for (const order of current) map.set(order._id, order);
  for (const order of incoming) map.set(order._id, order);
  return [...map.values()];
}

export default function CustomerOrdersPageClient() {
  const router = useRouter();
  const feedback = useFeedback();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [summary, setSummary] = useState<OrderSummaryStats | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [bucket, setBucket] = useState("all");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [reviewContext, setReviewContext] = useState<OrderReviewContextMap>({});
  const loadingRef = useRef(false);

  const filterKey = useMemo(
    () => `${bucket}|${appliedQ}|${sort}|${appliedDateFrom}|${appliedDateTo}`,
    [appliedDateFrom, appliedDateTo, appliedQ, bucket, sort],
  );

  const loadPage = useCallback(
    async (targetPage: number, append: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError("");
      try {
        const customer = await fetchCurrentCustomer();
        if (!customer) {
          router.push("/account/login?next=/account/orders");
          return;
        }
        const queryParams = {
          page: String(targetPage),
          limit: "10",
          bucket: bucket === "all" ? undefined : bucket,
          q: appliedQ.trim() || undefined,
          sort,
          dateFrom: appliedDateFrom || undefined,
          dateTo: appliedDateTo || undefined,
        };
        const [summaryResult, listResult] = await Promise.all([
          targetPage === 1 ? fetchOrderSummary() : Promise.resolve(null),
          fetchCustomerOrders(queryParams),
        ]);
        if (summaryResult?.data) setSummary(summaryResult.data);
        const nextItems = listResult.data ?? [];
        setOrders((current) => (append ? mergeOrders(current, nextItems) : nextItems));
        const meta = listResult.meta as { page?: number; totalPages?: number } | null | undefined;
        if (meta?.page && meta?.totalPages) setHasMore(meta.page < meta.totalPages);
        else setHasMore(nextItems.length >= 10);

        const deliveredIds = nextItems
          .filter((order) => order.orderStatus === "delivered")
          .map((order) => order._id);
        if (deliveredIds.length) {
          const contextResult = await fetchOrderReviewContext(deliveredIds);
          setReviewContext((current) => ({ ...current, ...(contextResult.data ?? {}) }));
        }
      } catch {
        setError("We could not load your orders right now.");
        feedback.error("Orders unavailable", "Please try again in a moment.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [appliedDateFrom, appliedDateTo, appliedQ, bucket, feedback, router, sort],
  );

  useEffect(() => {
    setPage(1); // eslint-disable-line react-hooks/set-state-in-effect -- reset pagination when filters change
  }, [filterKey]);

  useEffect(() => {
    void loadPage(page, page > 1); // eslint-disable-line react-hooks/set-state-in-effect -- paginated order fetch
  }, [filterKey, page, loadPage]);

  function applyFilters() {
    setAppliedQ(q);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setPage(1);
  }

  function refreshReviewContext(orderId: string) {
    void fetchOrderReviewContext([orderId]).then((result) => {
      setReviewContext((current) => ({ ...current, ...(result.data ?? {}) }));
    });
  }

  return (
    <main className="commerce-page content-width orders-page">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale account</p>
          <h1>My Orders</h1>
          <p className="orders-page-lead">Track and manage your wholesale orders.</p>
        </div>
        {summary ? <p className="orders-count">{summary.total} total orders</p> : null}
      </div>

      {summary ? (
        <div className="orders-summary-grid">
          <article><strong>{summary.total}</strong><span>Total orders</span></article>
          <article><strong>{summary.pendingPayment}</strong><span>Pending</span></article>
          <article><strong>{summary.processing}</strong><span>Processing</span></article>
          <article><strong>{summary.shipped}</strong><span>Shipped</span></article>
          <article><strong>{summary.delivered}</strong><span>Delivered</span></article>
        </div>
      ) : null}

      <div className="orders-toolbar">
        <label>
          <span className="sr-only">Search orders</span>
          <input value={q} onChange={(event) => setQ(event.currentTarget.value)} placeholder="Search order number or product" />
        </label>
        <label>
          <span className="sr-only">Filter orders</span>
          <select value={bucket} onChange={(event) => setBucket(event.currentTarget.value)}>
            {FILTER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort orders</span>
          <select value={sort} onChange={(event) => setSort(event.currentTarget.value as "asc" | "desc")}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
        <label>
          From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
        </label>
        <label>
          To
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
        </label>
        <LoadingButton type="button" variant="secondary" loading={loading} onClick={applyFilters}>
          Apply filters
        </LoadingButton>
      </div>

      {loading && orders.length === 0 ? <OrderListSkeleton /> : null}
      {error ? (
        <ErrorCard title="Unable to load orders" description={error} action={<LoadingButton type="button" onClick={() => void loadPage(1, false)}>Try again</LoadingButton>} />
      ) : null}
      {!loading && !error && orders.length === 0 ? (
        <EmptyState title="No orders found" description="Try another filter or place your first wholesale order from the catalog." action={<Button href="/products">Browse catalog</Button>} />
      ) : null}

      <div className="orders-list">
        {orders.map((order) => {
          const firstItem = order.items[0];
          const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
          const canDownloadInvoice = order.paymentStatus !== "pending";
          return (
            <article className="orders-card" key={order._id}>
              <div className="orders-card-head">
                <div>
                  <strong>{order.orderNumber}</strong>
                  <small>{new Date(order.createdAt).toLocaleString()}</small>
                </div>
                <div className="orders-card-badges">
                  <OrderStatusBadge kind="payment" status={order.paymentStatus} />
                  <OrderStatusBadge kind="order" status={order.orderStatus} />
                </div>
              </div>
              <div className="orders-card-body">
                <div className="orders-card-thumb">
                  {firstItem?.imageUrl ? (
                    <Image src={firstItem.imageUrl} alt="" fill sizes="88px" className="cover-image" />
                  ) : null}
                </div>
                <div>
                  <p>{firstItem?.productName ?? "Wholesale order"}</p>
                  <small>{order.items.length} line item(s) · {itemCount} units</small>
                  <strong>₹{order.totalAmount.toFixed(2)}</strong>
                  {order.shipment?.awb ? <small>AWB {order.shipment.awb}</small> : null}
                </div>
              </div>
              {order.orderStatus === "delivered" && reviewContext[order._id] ? (
                <div className="orders-card-reviews">
                  {Object.values(reviewContext[order._id]).map((context) => (
                    <OrderProductReviewAction
                      key={context.productId}
                      orderId={order._id}
                      context={context}
                      onUpdated={() => refreshReviewContext(order._id)}
                    />
                  ))}
                </div>
              ) : null}
              <div className="orders-card-actions">
                <Button href={`/account/orders/${order._id}`} variant="secondary">View details</Button>
                {order.shipment?.awb ? (
                  <Button href={`/account/orders/${order._id}#tracking`} variant="secondary">Track order</Button>
                ) : null}
                {canDownloadInvoice ? <DownloadInvoiceButton orderId={order._id} /> : null}
              </div>
            </article>
          );
        })}
      </div>

      {hasMore ? (
        <LoadingButton type="button" className="orders-load-more" loading={loading} onClick={() => setPage((value) => value + 1)}>
          Load more
        </LoadingButton>
      ) : null}
    </main>
  );
}

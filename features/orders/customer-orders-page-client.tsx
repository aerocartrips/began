"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Package } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import EmptyState from "@/components/ui/empty-state";
import ErrorCard from "@/components/ui/feedback/error-card";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import DownloadInvoiceButton from "@/components/orders/download-invoice-button";
import { OrderListSkeleton } from "@/components/ui/loaders/order-list-skeleton";
import OrderProductReviewAction from "@/components/reviews/order-product-review-action";
import { fetchCustomerOrders, fetchOrderSummary } from "@/features/orders/order-api";
import OrderStatusBadge from "@/features/orders/order-status-badge";
import type { OrderListItem, OrderSummaryStats } from "@/features/orders/types";
import { fetchOrderReviewContext } from "@/features/reviews/review-api";
import type { OrderReviewContextMap } from "@/features/reviews/types";
import { fetchCurrentCustomer } from "@/features/checkout/submit-checkout-order";
import { formatDate, formatRupees } from "@/lib/format";

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
    <main className="commerce-page content-width account-page">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Wholesale account</p>
          <h1>My Orders</h1>
          <p className="account-lead">Track, manage, and review your wholesale orders.</p>
        </div>
        <Button href="/products" variant="secondary" size="sm">Browse catalog</Button>
      </div>

      {summary ? (
        <div className="account-stats" aria-label="Order summary">
          <article><strong>{summary.total}</strong><span>Total orders</span></article>
          <article><strong>{summary.pendingPayment}</strong><span>Pending payment</span></article>
          <article><strong>{summary.processing}</strong><span>Processing</span></article>
          <article><strong>{summary.shipped}</strong><span>Shipped</span></article>
          <article><strong>{summary.delivered}</strong><span>Delivered</span></article>
        </div>
      ) : null}

      <form
        className="account-filters"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <label className="account-field account-field--search">
          Search
          <input type="search" value={q} onChange={(event) => setQ(event.currentTarget.value)} placeholder="Order number or product" />
        </label>
        <label className="account-field">
          Status
          <select value={bucket} onChange={(event) => setBucket(event.currentTarget.value)}>
            {FILTER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="account-field">
          Sort
          <select value={sort} onChange={(event) => setSort(event.currentTarget.value as "asc" | "desc")}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
        <label className="account-field">
          From
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.currentTarget.value)} />
        </label>
        <label className="account-field">
          To
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.currentTarget.value)} />
        </label>
        <LoadingButton type="submit" size="sm" loading={loading && orders.length > 0}>
          Apply
        </LoadingButton>
      </form>

      {loading && orders.length === 0 ? <OrderListSkeleton /> : null}
      {error ? (
        <ErrorCard title="Unable to load orders" description={error} action={<LoadingButton type="button" size="sm" onClick={() => void loadPage(1, false)}>Try again</LoadingButton>} />
      ) : null}
      {!loading && !error && orders.length === 0 ? (
        <EmptyState
          className="account-empty"
          icon={<Package size={20} />}
          title="No orders found"
          description="Try a different filter, or place your first wholesale order from the catalog."
          action={<Button href="/products" size="sm">Browse catalog</Button>}
        />
      ) : null}

      <div className="orders-list">
        {orders.map((order) => {
          const firstItem = order.items[0];
          const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
          const extraLines = order.items.length - 1;
          const canDownloadInvoice = order.paymentStatus !== "pending";
          return (
            <article className="orders-card" key={order._id}>
              <header className="orders-card-head">
                <div>
                  <Link className="orders-card-number" href={`/account/orders/${order._id}`}>{order.orderNumber}</Link>
                  <small>Placed {formatDate(order.createdAt)}</small>
                </div>
                <div className="orders-card-badges">
                  <OrderStatusBadge kind="order" status={order.orderStatus} />
                  <OrderStatusBadge kind="payment" status={order.paymentStatus} />
                </div>
              </header>
              <div className="orders-card-body">
                <div className="orders-card-thumb">
                  {firstItem?.imageUrl ? (
                    <Image src={firstItem.imageUrl} alt="" fill sizes="88px" className="cover-image" />
                  ) : null}
                </div>
                <div className="orders-card-info">
                  <h2>{firstItem?.productName ?? "Wholesale order"}</h2>
                  <p>
                    {extraLines > 0 ? `+ ${extraLines} more ${extraLines === 1 ? "product" : "products"} · ` : ""}
                    {itemCount} units
                  </p>
                  {order.shipment?.awb ? <p className="orders-card-awb">AWB {order.shipment.awb}</p> : null}
                </div>
                <div className="orders-card-total">
                  <span>Order total</span>
                  <strong>{formatRupees(order.totalAmount)}</strong>
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
              <footer className="orders-card-actions">
                <Button href={`/account/orders/${order._id}`} size="sm" icon={<ArrowRight size={14} aria-hidden="true" />}>
                  View details
                </Button>
                {order.shipment?.awb ? (
                  <Button href={`/account/orders/${order._id}#tracking`} variant="secondary" size="sm">Track shipment</Button>
                ) : null}
                {canDownloadInvoice ? <DownloadInvoiceButton orderId={order._id} /> : null}
              </footer>
            </article>
          );
        })}
      </div>

      {hasMore ? (
        <div className="account-load-more">
          <LoadingButton type="button" variant="secondary" size="sm" loading={loading} onClick={() => setPage((value) => value + 1)}>
            Load more orders
          </LoadingButton>
        </div>
      ) : null}
    </main>
  );
}

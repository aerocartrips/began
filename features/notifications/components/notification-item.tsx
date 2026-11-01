"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Check,
  CreditCard,
  MessageSquare,
  Package,
  PackageCheck,
  RotateCcw,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import type { AppNotification } from "@/features/notifications/types";

const ICON_BY_TYPE: Record<string, LucideIcon> = {
  payment_succeeded: CreditCard,
  payment_failed: CreditCard,
  payment_issue: CreditCard,
  new_order: Package,
  order_status_changed: Package,
  cancellation_requested: Package,
  return_requested: RotateCcw,
  shipment_booked: Truck,
  shipment_booking_failed: Truck,
  shipment_reconciliation: Truck,
  manifest_failed: Truck,
  refund_initiated: RotateCcw,
  refund_completed: RotateCcw,
  refund_failed: RotateCcw,
  admin_refund_failed: RotateCcw,
  support_reply: MessageSquare,
  support_status_changed: MessageSquare,
  support_new_conversation: MessageSquare,
  support_customer_message: MessageSquare,
  support_unanswered: MessageSquare,
  back_in_stock: PackageCheck,
  low_stock: PackageCheck,
  out_of_stock: PackageCheck,
};

type NotificationItemProps = {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  onMarkRead: (notification: AppNotification) => void;
};

export default function NotificationItem({ notification, onOpen, onMarkRead }: NotificationItemProps) {
  const alert = notification.severity === "critical" || notification.severity === "warning";
  const Icon = (alert ? AlertTriangle : ICON_BY_TYPE[notification.type]) ?? Bell;
  const className = [
    "notification-item",
    `notification-item--${notification.severity}`,
    notification.isRead ? "is-read" : "is-unread",
  ].join(" ");

  const body = (
    <>
      <span className="notification-item__icon" aria-hidden="true">
        <Icon size={15} strokeWidth={1.9} />
      </span>
      <span className="notification-item__copy">
        <strong>
          {notification.title}
          {notification.count > 1 ? <span className="notification-item__count"> · {notification.count} new</span> : null}
        </strong>
        {notification.message ? <span className="notification-item__message">{notification.message}</span> : null}
        <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
      </span>
      {notification.isRead ? null : <span className="sr-only">Unread.</span>}
    </>
  );

  return (
    <li className={className}>
      {notification.url ? (
        <Link href={notification.url} className="notification-item__main" data-notification-item onClick={() => onOpen(notification)}>
          {body}
        </Link>
      ) : (
        <button type="button" className="notification-item__main" data-notification-item onClick={() => onOpen(notification)}>
          {body}
        </button>
      )}
      {notification.isRead ? null : (
        <button
          type="button"
          className="notification-item__read"
          aria-label={`Mark "${notification.title}" as read`}
          title="Mark as read"
          onClick={() => onMarkRead(notification)}
        >
          <Check size={13} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

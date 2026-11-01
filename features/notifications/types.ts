export type NotificationScope = "customer" | "admin";

export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type AppNotification = {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  url: string | null;
  isRead: boolean;
  readAt: string | null;
  /** Number of events merged into this notification (e.g. several chat messages). */
  count: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type NotificationPage = {
  items: AppNotification[];
  hasMore: boolean;
  nextCursor: string | null;
  unreadCount: number;
};

import { apiRequest } from "@/lib/api/api-client";
import type { AppNotification, NotificationPage, NotificationScope } from "@/features/notifications/types";

const BASE: Record<NotificationScope, string> = {
  customer: "/api/v1/notifications",
  admin: "/api/v1/admin/notifications",
};

export const INBOX_PATH: Record<NotificationScope, string> = {
  customer: "/account/notifications",
  admin: "/admin/notifications",
};

export const notificationApi = {
  async list(
    scope: NotificationScope,
    { cursor, limit = 20, unreadOnly = false, signal }: { cursor?: string | null; limit?: number; unreadOnly?: boolean; signal?: AbortSignal } = {},
  ): Promise<NotificationPage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    if (unreadOnly) params.set("unread", "1");
    const result = await apiRequest<AppNotification[]>(`${BASE[scope]}?${params}`, { signal });
    const meta = (result.meta ?? {}) as Partial<NotificationPage>;
    return {
      items: result.data ?? [],
      hasMore: Boolean(meta.hasMore),
      nextCursor: meta.nextCursor ?? null,
      unreadCount: Number(meta.unreadCount ?? 0),
    };
  },

  async unreadCount(scope: NotificationScope, signal?: AbortSignal) {
    const result = await apiRequest<{ unreadCount: number }>(`${BASE[scope]}/unread-count`, { signal });
    return Number(result.data?.unreadCount ?? 0);
  },

  async markRead(scope: NotificationScope, id: string) {
    const result = await apiRequest<{ id: string; unreadCount: number }>(`${BASE[scope]}/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    });
    return Number(result.data?.unreadCount ?? 0);
  },

  async markAllRead(scope: NotificationScope) {
    await apiRequest<{ updated: number }>(`${BASE[scope]}/read-all`, { method: "PATCH" });
    return 0;
  },
};

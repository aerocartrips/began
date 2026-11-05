import { apiRequest } from "@/lib/api/api-client";
import type {
  AdminConversationDetail,
  CustomerConversation,
  MessagesPage,
  NewConversationInput,
  ThreadMessage,
} from "@/features/support/types";

const CUSTOMER_BASE = "/api/v1/support/conversations";
const ADMIN_BASE = "/api/v1/admin/support/conversations";

function jsonBody(payload: unknown) {
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

type PageParams = { before?: string; after?: string; limit?: number };

function pageQuery({ before, after, limit }: PageParams) {
  const search = new URLSearchParams();
  if (before) search.set("before", before);
  if (after) search.set("after", after);
  if (limit) search.set("limit", String(limit));
  const query = search.toString();
  return query ? `?${query}` : "";
}

function toPage<T>(result: { data: ThreadMessage[] | null; meta?: Record<string, unknown> | null }): MessagesPage<T> {
  const meta = (result.meta ?? {}) as { hasMore?: boolean; conversation?: T };
  return { items: result.data ?? [], hasMore: Boolean(meta.hasMore), conversation: meta.conversation ?? null };
}

export function createRequestKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/* Customer */

export async function fetchCustomerConversations(page: number, signal?: AbortSignal) {
  const result = await apiRequest<CustomerConversation[]>(`${CUSTOMER_BASE}?page=${page}&limit=20`, { signal });
  const meta = (result.meta ?? {}) as { page?: number; totalPages?: number; unreadConversations?: number };
  return {
    items: result.data ?? [],
    hasMore: Boolean(meta.page && meta.totalPages && meta.page < meta.totalPages),
    unreadConversations: meta.unreadConversations ?? 0,
  };
}

export async function fetchCustomerConversation(conversationId: string, signal?: AbortSignal) {
  const result = await apiRequest<CustomerConversation>(`${CUSTOMER_BASE}/${encodeURIComponent(conversationId)}`, { signal });
  return result.data as CustomerConversation;
}

export async function createCustomerConversation(input: NewConversationInput) {
  const result = await apiRequest<CustomerConversation>(CUSTOMER_BASE, { method: "POST", ...jsonBody(input) });
  return result.data as CustomerConversation;
}

export async function closeCustomerConversation(conversationId: string) {
  const result = await apiRequest<CustomerConversation>(`${CUSTOMER_BASE}/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    ...jsonBody({ status: "closed" }),
  });
  return result.data as CustomerConversation;
}

export function customerThreadApi(conversationId: string) {
  const base = `${CUSTOMER_BASE}/${encodeURIComponent(conversationId)}`;
  return {
    async fetchMessages(params: PageParams, signal?: AbortSignal) {
      const result = await apiRequest<ThreadMessage[]>(`${base}/messages${pageQuery(params)}`, { signal });
      return toPage<CustomerConversation>(result);
    },
    async sendMessage(body: string, clientMessageId: string) {
      const result = await apiRequest<ThreadMessage>(`${base}/messages`, { method: "POST", ...jsonBody({ body, clientMessageId }) });
      const meta = (result.meta ?? {}) as { conversation?: CustomerConversation };
      return { message: result.data as ThreadMessage, conversation: meta.conversation ?? null };
    },
    async markRead() {
      await apiRequest(`${base}/read`, { method: "POST" });
    },
  };
}

/* Admin */

export function adminThreadApi(conversationId: string) {
  const base = `${ADMIN_BASE}/${encodeURIComponent(conversationId)}`;
  return {
    async fetchMessages(params: PageParams, signal?: AbortSignal) {
      const result = await apiRequest<ThreadMessage[]>(`${base}/messages${pageQuery(params)}`, { signal });
      return toPage<AdminConversationDetail>(result);
    },
    async sendMessage(body: string, clientMessageId: string) {
      const result = await apiRequest<ThreadMessage>(`${base}/messages`, {
        method: "POST",
        ...jsonBody({ body, clientMessageId }),
      });
      return { message: result.data as ThreadMessage, conversation: null };
    },
    async markRead() {
      await apiRequest(`${base}/read`, { method: "POST" });
    },
  };
}

export async function updateAdminConversation(
  conversationId: string,
  payload: { status?: string; priority?: string; internalNotes?: string },
) {
  const result = await apiRequest<AdminConversationDetail>(`${ADMIN_BASE}/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    ...jsonBody(payload),
  });
  return result.data as AdminConversationDetail;
}

export type ThreadApi<TConversation> = {
  fetchMessages: (params: PageParams, signal?: AbortSignal) => Promise<MessagesPage<TConversation>>;
  sendMessage: (body: string, clientMessageId: string) => Promise<{ message: ThreadMessage; conversation: TConversation | null }>;
  markRead: () => Promise<void>;
};

export type SupportCategory = "order" | "payment" | "shipping" | "product" | "return" | "other";

export type CustomerSupportStatus = "open" | "pending" | "resolved" | "closed";

export type ThreadSender = "customer" | "support" | "system";

export type ThreadMessage = {
  id: string;
  cursor: string;
  body: string;
  sender: ThreadSender;
  createdAt: string;
  clientMessageId: string | null;
  seen: boolean;
};

/** A message the viewer has written that the server has not confirmed yet. */
export type PendingMessage = {
  localId: string;
  clientMessageId: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
  error?: string;
};

export type CustomerConversation = {
  id: string;
  subject: string;
  category: SupportCategory;
  status: CustomerSupportStatus;
  canReply: boolean;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageFrom: "customer" | "support" | null;
  lastMessageAt: string;
  createdAt: string;
  order: { id: string; orderNumber: string | null } | null;
};

export type AdminConversationDetail = {
  id: string;
  conversationId: string;
  customerId: string | null;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  subject: string;
  category: SupportCategory;
  source: "contact" | "account";
  status: string;
  priority: string;
  unread: boolean;
  unreadCount: number;
  awaitingReply: boolean;
  lastMessageFrom: "customer" | "support" | null;
  orderId: string | null;
  orderNumber: string | null;
  preview: string;
  internalNotes: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessagesPage<TConversation> = {
  items: ThreadMessage[];
  hasMore: boolean;
  conversation: TConversation | null;
};

export type NewConversationInput = {
  category: SupportCategory;
  subject: string;
  message: string;
  orderId?: string;
  clientRequestId: string;
};

export type OrderSummaryStats = {
  total: number;
  pendingPayment: number;
  processing: number;
  shipped: number;
  delivered: number;
  paid: number;
  cancelled: number;
};

export type OrderListItem = {
  _id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: number;
  currency?: string;
  createdAt: string;
  items: {
    product?: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageUrl?: string;
  }[];
  shipment?: {
    awb?: string;
    lrNumber?: string;
    carrier?: string;
    status?: string;
    bookingStatus?: string;
    manifestStatus?: string;
    estimatedDelivery?: string;
    trackingFetchedAt?: string;
  } | null;
};

/** What the customer may still do, from the store's cancellation and return windows (customer view only). */
export type OrderActions = {
  canCancel: boolean;
  cancelUntil: string | null;
  canRequestReturn: boolean;
  returnUntil: string | null;
};

export type OrderDetail = OrderListItem & {
  subtotal: number;
  discount: number;
  shippingCharges: number;
  tax: number;
  paymentMethod?: string;
  paymentExpiresAt?: string | null;
  deliveredAt?: string | null;
  /** Admin view only. */
  internalNotes?: string;
  customerVisibleRemark?: string;
  actions?: OrderActions;
  invoice?: { number: string; issuedAt?: string | null } | null;
  shippingAddress: Record<string, string>;
  billingAddress: Record<string, string>;
  statusHistory?: {
    previousOrderStatus?: string;
    newOrderStatus?: string;
    previousPaymentStatus?: string;
    newPaymentStatus?: string;
    customerVisibleRemark?: string;
    /** Staff remark; admin view only. */
    remarks?: string;
    changedByLabel?: string;
    createdAt?: string;
  }[];
  returnRequest?: { status: string; reason?: string; remarks?: string; requestedAt?: string } | null;
  cancellation?: { reason?: string; cancelledAt?: string } | null;
  cancellationRefund?: {
    status: string;
    message?: string;
    razorpayRefundId?: string;
    updatedAt?: string;
  };
};

export type OrderPaymentInfo = {
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  capturedAt?: string;
};

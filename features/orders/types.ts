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
  };
};

export type OrderDetail = OrderListItem & {
  subtotal: number;
  discount: number;
  shippingCharges: number;
  tax: number;
  paymentMethod?: string;
  internalNotes?: string;
  customerVisibleRemark?: string;
  shippingAddress: Record<string, string>;
  billingAddress: Record<string, string>;
  statusHistory?: {
    previousOrderStatus?: string;
    newOrderStatus?: string;
    previousPaymentStatus?: string;
    newPaymentStatus?: string;
    customerVisibleRemark?: string;
    remarks?: string;
    createdAt?: string;
  }[];
  returnRequest?: { status: string; reason?: string; remarks?: string; requestedAt?: string };
  cancellation?: { reason?: string; cancelledAt?: string };
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

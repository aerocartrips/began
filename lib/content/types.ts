export type StorePageSection = { heading: string; body: string };
export type StorePageFaq = { question: string; answer: string };

export type StorePageContent = {
  slug: string;
  title: string;
  summary: string;
  sections: StorePageSection[];
  faqs: StorePageFaq[];
  /** True while the store still shows the default template. */
  isDefault: boolean;
  updatedAt: string | null;
};

/** Purchase terms from Admin → Settings, shown on the product page. */
export type StorePolicies = {
  /** Days after delivery a return can be requested; 0 means no returns. */
  returnWindowDays: number;
  /** Shipping per order (₹); 0 means shipping is always free. */
  shippingFlatAmount: number;
  /** Order subtotal (₹) from which shipping is free; 0 disables. */
  shippingFreeThreshold: number;
  /** "Only N left" shows at or below this stock. */
  lowStockThreshold: number;
  /** Minutes an unpaid order holds its stock while the shopper pays. */
  paymentReservationMinutes: number;
  /** Working days from payment to dispatch; a maximum of 0 means not stated. */
  dispatchMinDays: number;
  dispatchMaxDays: number;
  /** Days from dispatch to delivery; a maximum of 0 means not stated. */
  transitMinDays: number;
  transitMaxDays: number;
};

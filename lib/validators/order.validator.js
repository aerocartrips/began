import { z } from "zod";
import { ORDER_STATUS_VALUES, PAYMENT_STATUS_VALUES } from "@/lib/constants/order-status";
import { gstinSchema } from "@/lib/validators/account.validator";

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(25),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().min(4).max(12),
  country: z.string().trim().min(2).max(80).default("India"),
  gstin: gstinSchema.optional(),
});

const orderItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(100000),
  selectedAttributes: z.record(z.string(), z.string()).optional(),
});

const savedAddressIdSchema = z.string().trim().min(1).max(64);

/**
 * Each address is either a saved address id (resolved against the customer's
 * own address book on the server) or a full address. Billing defaults to shipping.
 */
export const createOrderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1).max(100),
    shippingAddress: addressSchema.optional(),
    shippingAddressId: savedAddressIdSchema.optional(),
    billingAddress: addressSchema.optional(),
    billingAddressId: savedAddressIdSchema.optional(),
    paymentMethod: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.shippingAddress && !value.shippingAddressId) {
      ctx.addIssue({ code: "custom", path: ["shippingAddress"], message: "A shipping address is required." });
    }
    if (value.shippingAddress && value.shippingAddressId) {
      ctx.addIssue({ code: "custom", path: ["shippingAddressId"], message: "Choose a saved address or enter a new one, not both." });
    }
    if (value.billingAddress && value.billingAddressId) {
      ctx.addIssue({ code: "custom", path: ["billingAddressId"], message: "Choose a saved address or enter a new one, not both." });
    }
  });

export const updateOrderStatusSchema = z.object({
  orderStatus: z.enum(ORDER_STATUS_VALUES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
  customerVisibleRemark: z.string().trim().max(1000).optional(),
  shipmentAwb: z.string().trim().max(64).optional(),
  shipmentStatus: z.string().trim().max(80).optional(),
  remarks: z.string().trim().max(2000).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const returnRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  remarks: z.string().trim().max(2000).optional(),
});

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  orderStatus: z.enum(ORDER_STATUS_VALUES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
  bucket: z.string().trim().max(40).optional(),
  q: z.string().trim().max(120).optional(),
  dateFrom: z.string().trim().max(32).optional(),
  dateTo: z.string().trim().max(32).optional(),
  sort: z.enum(["asc", "desc"]).optional(),
});

import { z } from "zod";
import { ORDER_STATUS_VALUES, PAYMENT_STATUS_VALUES } from "@/lib/constants/order-status";

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(25),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().min(4).max(12),
  country: z.string().trim().min(2).max(80).default("India"),
});

const orderItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(100000),
  selectedAttributes: z.record(z.string(), z.string()).optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(100),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
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

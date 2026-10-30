import { z } from "zod";

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(3).max(120),
  razorpay_payment_id: z.string().trim().min(3).max(120),
  razorpay_signature: z.string().trim().min(10).max(256),
});

export const createRefundSchema = z.object({
  orderId: z.string().trim().min(1),
  paymentId: z.string().trim().min(1).optional(),
  amount: z.number().int().positive().optional(),
  reason: z.string().trim().max(500).optional(),
});

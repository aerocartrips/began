import { z } from "zod";
import {
  MAX_REVIEW_COMMENT_LENGTH,
  MAX_REVIEW_TITLE_LENGTH,
  MIN_REVIEW_COMMENT_LENGTH,
  PUBLIC_REVIEW_SORT,
  REVIEW_MODERATION_STATUS,
} from "@/lib/constants/review-status";

export const createReviewSchema = z.object({
  productId: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(MAX_REVIEW_TITLE_LENGTH).optional().or(z.literal("")),
  comment: z
    .string()
    .trim()
    .min(MIN_REVIEW_COMMENT_LENGTH, `Review must be at least ${MIN_REVIEW_COMMENT_LENGTH} characters.`)
    .max(MAX_REVIEW_COMMENT_LENGTH),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().trim().max(MAX_REVIEW_TITLE_LENGTH).optional().or(z.literal("")),
  comment: z
    .string()
    .trim()
    .min(MIN_REVIEW_COMMENT_LENGTH)
    .max(MAX_REVIEW_COMMENT_LENGTH)
    .optional(),
});

export const orderContextSchema = z.object({
  orderIds: z.array(z.string().trim().min(1)).max(50),
});

export const moderateReviewSchema = z.object({
  moderationStatus: z.enum([
    REVIEW_MODERATION_STATUS.APPROVED,
    REVIEW_MODERATION_STATUS.REJECTED,
  ]),
  moderationNote: z.string().trim().max(500).optional().or(z.literal("")),
});

export const publicReviewListSchema = z.object({
  sort: z
    .enum([
      PUBLIC_REVIEW_SORT.RECENT,
      PUBLIC_REVIEW_SORT.HIGHEST,
      PUBLIC_REVIEW_SORT.LOWEST,
      PUBLIC_REVIEW_SORT.PHOTOS,
    ])
    .optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

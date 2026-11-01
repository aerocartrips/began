import mongoose from "mongoose";
import { z } from "zod";
import { SUPPORT_CATEGORY_VALUES, SUPPORT_LIMITS } from "@/lib/constants/support";

// Control characters other than tab and newline have no place in a chat message.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Normalises line endings, strips control characters and collapses runs of
 * blank lines so stored bodies are predictable. Output is rendered as text,
 * never as HTML.
 * @param {string} value
 */
export function normalizeMessageBody(value) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

const idempotencyKey = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request key.")
  .optional();

const messageBody = z
  .string({ error: "Write a message before sending." })
  .transform(normalizeMessageBody)
  .pipe(
    z
      .string()
      .min(1, "Write a message before sending.")
      .max(SUPPORT_LIMITS.messageMax, `Messages can be up to ${SUPPORT_LIMITS.messageMax.toLocaleString("en-IN")} characters.`),
  );

export const createSupportConversationSchema = z.object({
  category: z.enum(SUPPORT_CATEGORY_VALUES, { error: "Choose a topic." }),
  subject: z
    .string({ error: "Enter a subject." })
    .transform((value) => value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(SUPPORT_LIMITS.subjectMin, `Subject must be at least ${SUPPORT_LIMITS.subjectMin} characters.`)
        .max(SUPPORT_LIMITS.subjectMax, `Subject can be up to ${SUPPORT_LIMITS.subjectMax} characters.`),
    ),
  message: messageBody,
  orderId: z
    .string()
    .trim()
    .refine((value) => value === "" || mongoose.isValidObjectId(value), "Choose a valid order.")
    .optional()
    .transform((value) => value || null),
  clientRequestId: idempotencyKey,
});

export const sendSupportMessageSchema = z.object({
  body: messageBody,
  clientMessageId: idempotencyKey,
});

export const customerConversationUpdateSchema = z.object({
  status: z.literal("closed", { error: "You can only close a conversation." }),
});

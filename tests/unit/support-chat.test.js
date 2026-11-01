import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { canCustomerReply, toCustomerStatus, toThreadMessage } from "@/lib/services/support-chat.service";
import { decodeMessageCursor, encodeMessageCursor, messagePreview } from "@/lib/repositories/support.repository";
import {
  createSupportConversationSchema,
  normalizeMessageBody,
  sendSupportMessageSchema,
} from "@/lib/validators/support.validator";
import { mergeMessages } from "@/features/support/use-support-thread";

const DAY = 24 * 60 * 60 * 1000;

describe("customer support status", () => {
  it("collapses workflow statuses into customer-facing ones", () => {
    expect(toCustomerStatus("open")).toBe("open");
    expect(toCustomerStatus("in_progress")).toBe("pending");
    expect(toCustomerStatus("waiting_customer")).toBe("pending");
    expect(toCustomerStatus("resolved")).toBe("resolved");
    expect(toCustomerStatus("closed")).toBe("closed");
    expect(toCustomerStatus(undefined)).toBe("open");
  });

  it("allows replies until closed, and on resolved threads only within the reopen window", () => {
    const now = Date.now();
    expect(canCustomerReply({ status: "open" }, now)).toBe(true);
    expect(canCustomerReply({ status: "closed" }, now)).toBe(false);
    expect(canCustomerReply({ status: "resolved", resolvedAt: new Date(now - 2 * DAY) }, now)).toBe(true);
    expect(canCustomerReply({ status: "resolved", resolvedAt: new Date(now - 31 * DAY) }, now)).toBe(false);
    // Legacy resolved conversations have no resolvedAt.
    expect(canCustomerReply({ status: "resolved", resolvedAt: null }, now)).toBe(true);
  });
});

describe("message cursors", () => {
  it("round-trips createdAt and id", () => {
    const message = { _id: new mongoose.Types.ObjectId(), createdAt: new Date("2026-10-31T10:00:00.123Z") };
    const decoded = decodeMessageCursor(encodeMessageCursor(message));
    expect(decoded.createdAt.toISOString()).toBe("2026-10-31T10:00:00.123Z");
    expect(String(decoded.id)).toBe(String(message._id));
  });

  it("rejects tampered cursors", () => {
    for (const bad of ["", "abc", "zz.notanid", `1.${"g".repeat(24)}`, "{$gt:1}.x"]) {
      expect(() => decodeMessageCursor(bad)).toThrow();
    }
  });
});

describe("support validators", () => {
  it("normalises message bodies", () => {
    expect(normalizeMessageBody("  hi\r\nthere\u0000\u0007\n\n\n\n\nend  ")).toBe("hi\nthere\n\n\nend");
  });

  it("enforces message limits", () => {
    expect(sendSupportMessageSchema.safeParse({ body: "" }).success).toBe(false);
    expect(sendSupportMessageSchema.safeParse({ body: " \n " }).success).toBe(false);
    expect(sendSupportMessageSchema.safeParse({ body: "a".repeat(5001) }).success).toBe(false);
    expect(sendSupportMessageSchema.safeParse({ body: "a".repeat(5000) }).success).toBe(true);
    expect(sendSupportMessageSchema.safeParse({ body: "ok", clientMessageId: "bad key!" }).success).toBe(false);
    expect(sendSupportMessageSchema.safeParse({ body: { $gt: "" } }).success).toBe(false);
  });

  it("requires a known category and a valid order id", () => {
    const base = { category: "payment", subject: "Refund status", message: "Hello" };
    expect(createSupportConversationSchema.safeParse(base).success).toBe(true);
    expect(createSupportConversationSchema.safeParse({ ...base, category: "billing" }).success).toBe(false);
    expect(createSupportConversationSchema.safeParse({ ...base, orderId: "123" }).success).toBe(false);
    expect(createSupportConversationSchema.parse({ ...base, orderId: "" }).orderId).toBeNull();
  });

  it("builds compact previews", () => {
    expect(messagePreview("line one\n\nline   two")).toBe("line one line two");
    expect(messagePreview("x".repeat(400))).toHaveLength(160);
  });
});

describe("thread message DTO", () => {
  it("maps sender roles without exposing sender identity", () => {
    const base = { _id: new mongoose.Types.ObjectId(), body: "Hi", createdAt: new Date(), sender: new mongoose.Types.ObjectId() };
    expect(toThreadMessage({ ...base, senderRole: "customer" }).sender).toBe("customer");
    expect(toThreadMessage({ ...base, senderRole: "admin" }).sender).toBe("support");
    expect(toThreadMessage({ ...base, senderRole: "system" }).sender).toBe("system");
    expect(Object.keys(toThreadMessage({ ...base, senderRole: "admin" }))).not.toContain("senderId");
  });
});

describe("mergeMessages", () => {
  const message = (id, iso) => ({ id, cursor: id, body: id, sender: "customer", createdAt: iso, clientMessageId: null, seen: false });

  it("dedupes by id and keeps chronological order", () => {
    const current = [message("b", "2026-01-01T00:00:02Z"), message("c", "2026-01-01T00:00:03Z")];
    const merged = mergeMessages(current, [message("a", "2026-01-01T00:00:01Z"), message("c", "2026-01-01T00:00:03Z")]);
    expect(merged.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("returns the same array when nothing new arrives", () => {
    const current = [message("a", "2026-01-01T00:00:01Z")];
    expect(mergeMessages(current, [])).toBe(current);
  });
});

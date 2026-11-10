import { describe, expect, it } from "vitest";
import { customerOrderActions, deliveredAtOf, unavailableActionMessage } from "@/lib/services/order-policy";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-07T12:00:00Z");
const WINDOWS = { cancellationWindowHours: 48, returnWindowDays: 7 };
const ago = (ms) => new Date(NOW.getTime() - ms);

describe("customer order actions", () => {
  it("treats an unpaid order as awaiting payment only inside its payment window", () => {
    const order = { orderStatus: "pending_payment", paymentStatus: "pending", createdAt: ago(10 * 60 * 1000) };
    expect(customerOrderActions({ ...order, paymentExpiresAt: new Date(NOW.getTime() + 20 * 60 * 1000) }, WINDOWS, NOW).awaitingPayment).toBe(true);
    expect(customerOrderActions({ ...order, paymentExpiresAt: ago(60 * 1000) }, WINDOWS, NOW).awaitingPayment).toBe(false);
    expect(customerOrderActions({ ...order, paymentStatus: "paid", orderStatus: "confirmed", paymentExpiresAt: new Date(NOW.getTime() + HOUR) }, WINDOWS, NOW).awaitingPayment).toBe(false);
  });

  it("lets an unpaid order be cancelled at any time before payment", () => {
    const order = { orderStatus: "pending_payment", paymentStatus: "pending", createdAt: ago(30 * DAY) };
    expect(customerOrderActions(order, WINDOWS, NOW)).toMatchObject({ canCancel: true, cancelUntil: null });
  });

  it("lets a paid order be cancelled only within the cancellation window", () => {
    const order = { orderStatus: "confirmed", paymentStatus: "paid", createdAt: ago(47 * HOUR) };
    expect(customerOrderActions(order, WINDOWS, NOW)).toMatchObject({ canCancel: true, cancelUntil: new Date(NOW.getTime() + HOUR) });
    expect(customerOrderActions({ ...order, createdAt: ago(49 * HOUR) }, WINDOWS, NOW).canCancel).toBe(false);
    expect(customerOrderActions(order, { ...WINDOWS, cancellationWindowHours: 0 }, NOW).canCancel).toBe(false);
  });

  it("never allows cancelling once the order is with the courier", () => {
    const order = { orderStatus: "shipped", paymentStatus: "paid", createdAt: ago(HOUR) };
    expect(customerOrderActions(order, WINDOWS, NOW).canCancel).toBe(false);
    expect(unavailableActionMessage("cancel", order)).toMatch(/current stage/);
  });

  it("accepts return requests within the return window after delivery", () => {
    const order = { orderStatus: "delivered", paymentStatus: "paid", deliveredAt: ago(6 * DAY), returnRequest: { status: "none" } };
    expect(customerOrderActions(order, WINDOWS, NOW)).toMatchObject({ canRequestReturn: true, returnUntil: new Date(NOW.getTime() + DAY) });
    const expired = { ...order, deliveredAt: ago(8 * DAY) };
    expect(customerOrderActions(expired, WINDOWS, NOW).canRequestReturn).toBe(false);
    expect(unavailableActionMessage("return", expired)).toMatch(/window/);
    expect(customerOrderActions({ ...order, returnRequest: { status: "pending" } }, WINDOWS, NOW).canRequestReturn).toBe(false);
  });

  it("dates delivery from the status history for orders delivered before deliveredAt existed", () => {
    const deliveredOn = ago(2 * DAY);
    const order = {
      orderStatus: "delivered",
      statusHistory: [
        { newOrderStatus: "shipped", createdAt: ago(4 * DAY) },
        { newOrderStatus: "delivered", createdAt: deliveredOn },
      ],
    };
    expect(deliveredAtOf(order)).toEqual(deliveredOn);
    expect(customerOrderActions(order, WINDOWS, NOW).canRequestReturn).toBe(true);
  });
});

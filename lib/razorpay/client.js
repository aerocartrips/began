import Razorpay from "razorpay";
import { assertRazorpayConfig } from "@/lib/razorpay/config";

/** @type {Razorpay | null} */
let client = null;

export function getRazorpayClient() {
  if (client) return client;
  const { key_id, key_secret } = assertRazorpayConfig();
  client = new Razorpay({ key_id, key_secret });
  return client;
}

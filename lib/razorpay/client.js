import Razorpay from "razorpay";
import { assertRazorpayConfig } from "@/lib/razorpay/config";

/** One SDK client per store key, reused across requests. */
const clients = new Map();

export async function getRazorpayClient() {
  const { key_id, key_secret } = await assertRazorpayConfig();
  let client = clients.get(key_id);
  if (!client) {
    client = new Razorpay({ key_id, key_secret });
    clients.set(key_id, client);
  }
  return client;
}

import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

/** Per-store monotonic sequences (e.g. `invoice:25-26`), advanced atomically. */
const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 60 },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { versionKey: false },
);

counterSchema.index({ tenantId: 1, key: 1 }, { unique: true });
counterSchema.plugin(tenantScopePlugin);

export const Counter = mongoose.models.Counter ?? mongoose.model("Counter", counterSchema);

/**
 * Next value of the `key` sequence in the current store, starting at 1.
 * Pass the caller's transaction session so an aborted transaction leaves no gap.
 * @param {string} key
 * @param {import("mongoose").ClientSession} [session]
 */
export async function nextSequence(key, session) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  ).lean();
  return counter.seq;
}

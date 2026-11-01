import mongoose from "mongoose";

const rateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, maxlength: 128 },
    count: { type: Number, required: true, default: 0, min: 0 },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// MongoDB removes buckets shortly after their window ends.
rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit =
  mongoose.models.RateLimit ?? mongoose.model("RateLimit", rateLimitSchema);

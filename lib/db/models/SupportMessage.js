import mongoose from "mongoose";

export const SUPPORT_SENDER_ROLE = {
  CUSTOMER: "customer",
  ADMIN: "admin",
  SYSTEM: "system",
};

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportConversation",
      required: true,
      index: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    senderRole: {
      type: String,
      enum: Object.values(SUPPORT_SENDER_ROLE),
      required: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
    readByAdmin: { type: Boolean, default: false },
    readByCustomer: { type: Boolean, default: false },
    legacyImported: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export const SupportMessage =
  mongoose.models.SupportMessage ?? mongoose.model("SupportMessage", messageSchema);

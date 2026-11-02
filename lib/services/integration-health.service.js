import mongoose from "mongoose";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { isDelhiveryConfigured } from "@/lib/delhivery/config";
import { isDelhiveryB2BConfigured } from "@/lib/delhivery/b2b-config";

function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.NOTIFY_EMAIL_FROM?.trim());
}

export async function getIntegrationHealth() {
  let mongoStatus = "unknown";
  let mongoError = "";
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      mongoStatus = "disconnected";
    } else {
      await mongoose.connection.db.admin().ping();
      mongoStatus = "ok";
    }
  } catch (error) {
    mongoStatus = "error";
    mongoError = error?.message ?? "MongoDB ping failed.";
  }

  const [razorpayConfigured, trackingConfigured, b2bConfigured] = await Promise.all([
    isRazorpayConfigured(),
    isDelhiveryConfigured(),
    isDelhiveryB2BConfigured(),
  ]);

  return {
    checkedAt: new Date().toISOString(),
    integrations: [
      {
        id: "mongodb",
        label: "MongoDB",
        configured: Boolean(process.env.MONGODB_URI?.trim()),
        status: mongoStatus,
        lastError: mongoError,
      },
      {
        id: "razorpay",
        label: "Razorpay",
        configured: razorpayConfigured,
        status: razorpayConfigured ? "configured" : "not_configured",
        lastError: "",
      },
      {
        id: "cloudinary",
        label: "Cloudinary",
        configured: cloudinaryConfigured(),
        status: cloudinaryConfigured() ? "configured" : "not_configured",
        lastError: "",
      },
      {
        id: "delhivery_tracking",
        label: "Delhivery tracking",
        configured: trackingConfigured,
        status: trackingConfigured ? "configured" : "not_configured",
        lastError: "",
      },
      {
        id: "delhivery_b2b",
        label: "Delhivery B2B booking",
        configured: b2bConfigured,
        status: b2bConfigured ? "configured" : "not_configured",
        lastError: b2bConfigured
          ? ""
          : "Add Delhivery B2B credentials to this store and set DELHIVERY_B2B_BOOKING_PATH.",
      },
      {
        id: "email",
        label: "Email (Resend)",
        configured: emailConfigured(),
        status: emailConfigured() ? "configured" : "not_configured",
        lastError: "",
      },
    ],
  };
}

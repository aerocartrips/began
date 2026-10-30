import { z } from "zod";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { getStoreSettingsDocument } from "@/lib/db/models/StoreSettings";

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const patchSettingsSchema = z
  .object({
    general: z
      .object({
        storeName: z.string().trim().min(1).max(160).optional(),
        supportEmail: z.union([z.string().trim().email(), z.literal("")]).optional(),
        supportPhone: z.string().trim().max(40).optional(),
        businessAddress: z.string().trim().max(500).optional(),
        defaultCurrency: z.string().trim().length(3).optional(),
        timeZone: z.string().trim().max(64).optional(),
      })
      .optional(),
    business: z
      .object({
        legalName: z.string().trim().max(200).optional(),
        gstin: z
          .string()
          .trim()
          .max(20)
          .optional()
          .refine((value) => !value || gstinRegex.test(value.toUpperCase()), {
            message: "Invalid GSTIN format.",
          }),
        registeredAddress: z.string().trim().max(500).optional(),
        invoicePrefix: z.string().trim().max(20).optional(),
      })
      .optional(),
    orders: z
      .object({
        paymentReservationMinutes: z.number().int().min(5).max(1440).optional(),
        cancellationWindowHours: z.number().int().min(0).max(720).optional(),
        returnWindowDays: z.number().int().min(0).max(90).optional(),
      })
      .optional(),
    shipping: z
      .object({
        pickupLocationName: z.string().trim().max(160).optional(),
        pickupPincode: z.string().trim().max(12).optional(),
        defaultWeightKg: z.number().min(0.1).max(500).optional(),
        defaultBoxCount: z.number().int().min(1).max(100).optional(),
        freightMode: z.string().trim().max(40).optional(),
      })
      .optional(),
  })
  .strict();

export async function getStoreSettings() {
  const doc = await getStoreSettingsDocument();
  return doc.toObject();
}

export async function updateStoreSettings(adminUser, payload) {
  const parsed = patchSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const doc = await getStoreSettingsDocument();
  for (const section of ["general", "business", "orders", "shipping"]) {
    if (parsed.data[section]) {
      Object.assign(doc[section], parsed.data[section]);
    }
  }
  doc.version += 1;
  doc.updatedBy = adminUser._id;
  await doc.save();
  return doc.toObject();
}

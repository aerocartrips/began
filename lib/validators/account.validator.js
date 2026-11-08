import { z } from "zod";
import {
  ADDRESS_LABELS,
  DEFAULT_ADDRESS_TYPES,
  DEFAULT_COUNTRY,
  DELETION_CONFIRMATION_PHRASE,
  INDIAN_STATES,
} from "@/lib/constants/account";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const INDIAN_PIN_PATTERN = /^[1-9]\d{5}$/;
const POSTAL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/;
const INDIAN_MOBILE_PATTERN = /^(?:\+?91|0)?([6-9]\d{9})$/;
const INTERNATIONAL_PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;
const STATE_LOOKUP = new Map(INDIAN_STATES.map((state) => [state.toLowerCase(), state]));

/**
 * Returns the canonical storage form of a phone number (10-digit Indian mobile
 * or E.164 international), or null when the value is malformed.
 * @param {string} value
 * @param {{ indiaOnly?: boolean }} [options]
 */
export function normalizePhone(value, options = {}) {
  const cleaned = value.replace(/[\s().-]/g, "");
  const indian = cleaned.match(INDIAN_MOBILE_PATTERN);
  if (indian) return indian[1];
  if (!options.indiaOnly && INTERNATIONAL_PHONE_PATTERN.test(cleaned)) return cleaned;
  return null;
}

export function isIndia(country) {
  return country.trim().toLowerCase() === DEFAULT_COUNTRY.toLowerCase();
}

const optionalText = (max) => z.string().trim().max(max).default("");

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(15)
  .refine((value) => !value || GSTIN_PATTERN.test(value), "Enter a valid 15-character GSTIN.");

const addressFields = {
  label: z.enum(ADDRESS_LABELS).default("home"),
  fullName: z.string().trim().min(2, "Enter the recipient's full name.").max(120),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(25),
  addressLine1: z.string().trim().min(3, "Enter the street address.").max(200),
  addressLine2: optionalText(200),
  landmark: optionalText(120),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  state: z.string().trim().min(2, "Enter the state.").max(80),
  pincode: z.string().trim().min(3, "Enter the PIN code.").max(12),
  country: z.string().trim().min(2).max(80).default(DEFAULT_COUNTRY),
  gstin: gstinSchema.default(""),
};

/**
 * Country-aware checks shared by saved addresses and checkout snapshots.
 * Normalizes phone, PIN code and state on success.
 * @param {Record<string, string>} address
 * @param {z.RefinementCtx} ctx
 */
function refineAddress(address, ctx) {
  const india = isIndia(address.country);
  const phone = normalizePhone(address.phone, { indiaOnly: india });
  if (!phone) {
    ctx.addIssue({
      code: "custom",
      path: ["phone"],
      message: india ? "Enter a valid 10-digit Indian mobile number." : "Enter the phone number in international format, e.g. +44 20 7946 0958.",
    });
  }

  if (india && !INDIAN_PIN_PATTERN.test(address.pincode)) {
    ctx.addIssue({ code: "custom", path: ["pincode"], message: "Enter a valid 6-digit PIN code." });
  } else if (!india && !POSTAL_CODE_PATTERN.test(address.pincode)) {
    ctx.addIssue({ code: "custom", path: ["pincode"], message: "Enter a valid postal code." });
  }

  if (india && !STATE_LOOKUP.has(address.state.toLowerCase())) {
    ctx.addIssue({ code: "custom", path: ["state"], message: "Select a valid Indian state or union territory." });
  }
}

function normalizeAddress(address) {
  const india = isIndia(address.country);
  return {
    ...address,
    phone: normalizePhone(address.phone, { indiaOnly: india }) ?? address.phone,
    state: india ? STATE_LOOKUP.get(address.state.toLowerCase()) ?? address.state : address.state,
    country: india ? DEFAULT_COUNTRY : address.country,
    pincode: india ? address.pincode : address.pincode.toUpperCase(),
  };
}

export const savedAddressSchema = z.object(addressFields).superRefine(refineAddress).transform(normalizeAddress);

export const addressWriteSchema = z
  .object({
    ...addressFields,
    makeDefaultShipping: z.boolean().optional(),
    makeDefaultBilling: z.boolean().optional(),
  })
  .superRefine(refineAddress)
  .transform(normalizeAddress);

export const defaultAddressSchema = z.object({
  type: z.enum(DEFAULT_ADDRESS_TYPES),
});

const nameSchema = z.string().trim().max(60);

export const profileUpdateSchema = z
  .object({
    firstName: nameSchema.min(1, "Enter your first name.").optional(),
    lastName: nameSchema.optional(),
    phone: z
      .string()
      .trim()
      .max(25)
      .refine((value) => !value || normalizePhone(value) !== null, "Enter a valid mobile number.")
      .transform((value) => (value ? normalizePhone(value) ?? value : ""))
      .optional(),
    companyName: z.string().trim().max(160).optional(),
    gstNumber: gstinSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one field to update.",
    path: ["body"],
  });

export const strongPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), "Use at least one letter and one number.");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().max(128),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
    }
    if (value.newPassword === value.currentPassword) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Choose a password different from your current one." });
    }
  });

export const preferencesSchema = z
  .object({
    orderUpdates: z.boolean().optional(),
    shippingUpdates: z.boolean().optional(),
    promotional: z.boolean().optional(),
    backInStock: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one preference to update.",
    path: ["body"],
  });

export const emailChangeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  currentPassword: z.string().max(128).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, "This reset link is invalid or has expired."),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().max(128),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
    }
  });

export const verifyEmailSchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, "Invalid or expired verification link."),
});

export const deletionRequestSchema = z.object({
  currentPassword: z.string().min(1, "Enter your password to confirm.").max(128),
  confirmation: z.literal(DELETION_CONFIRMATION_PHRASE, {
    error: `Type ${DELETION_CONFIRMATION_PHRASE} to confirm.`,
  }),
  reason: optionalText(500),
});

/**
 * @template {z.ZodType} T
 * @param {T} schema
 * @param {unknown} payload
 * @returns {z.output<T>}
 */
export function parseOrThrow(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }
  return parsed.data;
}

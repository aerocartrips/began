import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const secret = (name) =>
  optionalString.refine((value) => !value || Buffer.byteLength(value) >= 32, {
    message: `${name} must be at least 32 bytes.`,
  });

const nonNegativeNumber = (name) =>
  optionalString.refine((value) => value === undefined || (Number.isFinite(Number(value)) && Number(value) >= 0), {
    message: `${name} must be a non-negative number.`,
  });

const url = (name) =>
  optionalString.refine((value) => !value || URL.canParse(value), { message: `${name} must be a valid URL.` });

const envSchema = z.object({
  NODE_ENV: optionalString,
  MONGODB_URI: optionalString.refine((value) => !value || /^mongodb(\+srv)?:\/\//.test(value), {
    message: "MONGODB_URI must start with mongodb:// or mongodb+srv://.",
  }),
  AUTH_SECRET: secret("AUTH_SECRET"),
  JWT_SECRET: secret("JWT_SECRET"),
  JWT_REFRESH_SECRET: secret("JWT_REFRESH_SECRET"),
  ADMIN_EMAIL: optionalString.refine((value) => !value || z.email().safeParse(value).success, {
    message: "ADMIN_EMAIL must be an email address.",
  }),
  ADMIN_PASSWORD: optionalString,
  ADMIN_PASSWORD_HASH: optionalString.refine((value) => !value || /^\$2[aby]\$(1[2-9]|[2-3]\d)\$/.test(value), {
    message: "ADMIN_PASSWORD_HASH must be a bcrypt hash with cost 12 or higher.",
  }),
  CRON_SECRET: optionalString.refine((value) => !value || value.length >= 16, {
    message: "CRON_SECRET must be at least 16 characters.",
  }),
  NEXT_PUBLIC_APP_URL: url("NEXT_PUBLIC_APP_URL"),
  DELHIVERY_API_BASE_URL: url("DELHIVERY_API_BASE_URL"),
  TAX_RATE_PERCENT: nonNegativeNumber("TAX_RATE_PERCENT"),
  SHIPPING_FLAT_AMOUNT: nonNegativeNumber("SHIPPING_FLAT_AMOUNT"),
  SHIPPING_FREE_THRESHOLD: nonNegativeNumber("SHIPPING_FREE_THRESHOLD"),
  PAYMENT_RESERVATION_MINUTES: nonNegativeNumber("PAYMENT_RESERVATION_MINUTES"),
  LOW_STOCK_THRESHOLD: nonNegativeNumber("LOW_STOCK_THRESHOLD"),
  UPLOAD_MAX_BYTES: nonNegativeNumber("UPLOAD_MAX_BYTES"),
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: optionalString,
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  NOTIFY_EMAIL_TO: optionalString,
});

/**
 * @param {string[]} names
 * @param {Record<string, string | undefined>} env
 */
function partiallySet(names, env) {
  const set = names.filter((name) => env[name]);
  return set.length > 0 && set.length < names.length;
}

/**
 * Validates server configuration. Errors are fatal in production; warnings are
 * logged so optional integrations can stay unconfigured.
 * @param {Record<string, string | undefined>} [source]
 * @returns {{ errors: string[]; warnings: string[] }}
 */
export function validateEnv(source = process.env) {
  const errors = [];
  const warnings = [];
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    errors.push(...parsed.error.issues.map((issue) => issue.message));
  }

  // Cross-field checks still run when a format check failed, so all problems are reported at once.
  const env = Object.fromEntries(
    Object.entries(source).map(([name, value]) => [name, value?.trim() || undefined]),
  );
  const isProduction = source.NODE_ENV === "production";

  if (isProduction) {
    for (const name of ["MONGODB_URI", "AUTH_SECRET", "JWT_SECRET", "JWT_REFRESH_SECRET"]) {
      if (!source[name]?.trim()) errors.push(`${name} is required in production.`);
    }
    if (source.ADMIN_PASSWORD?.trim()) {
      warnings.push("ADMIN_PASSWORD is ignored in production; use ADMIN_PASSWORD_HASH or a database admin.");
    }
  }

  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push("JWT_SECRET and JWT_REFRESH_SECRET must be different.");
  }

  if (partiallySet(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"], env)) {
    errors.push("Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or neither.");
  }
  if (env.RAZORPAY_KEY_ID && env.NEXT_PUBLIC_RAZORPAY_KEY_ID && env.RAZORPAY_KEY_ID !== env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
    errors.push("NEXT_PUBLIC_RAZORPAY_KEY_ID must match RAZORPAY_KEY_ID.");
  }
  if (env.RAZORPAY_KEY_ID && !env.RAZORPAY_WEBHOOK_SECRET) {
    warnings.push("RAZORPAY_WEBHOOK_SECRET is not set; payment webhooks will be rejected.");
  }
  if (partiallySet(["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"], env)) {
    errors.push("Set all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or none.");
  }
  if (partiallySet(["RESEND_API_KEY", "NOTIFY_EMAIL_TO"], env)) {
    warnings.push("Email notifications need both RESEND_API_KEY and NOTIFY_EMAIL_TO.");
  }
  if (!env.MONGODB_URI && !isProduction) {
    warnings.push("MONGODB_URI is not set; the storefront uses the static demo catalog.");
  }

  return { errors, warnings };
}

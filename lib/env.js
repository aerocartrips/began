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
  TENANT_SECRETS_KEY: optionalString.refine(
    (value) => !value || Buffer.from(value, "base64").length === 32,
    { message: "TENANT_SECRETS_KEY must be 32 random bytes, base64-encoded." },
  ),
  CRON_SECRET: optionalString.refine((value) => !value || value.length >= 16, {
    message: "CRON_SECRET must be at least 16 characters.",
  }),
  DELHIVERY_API_BASE_URL: url("DELHIVERY_API_BASE_URL"),
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  NOTIFY_EMAIL_FROM: optionalString,
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
    for (const name of ["MONGODB_URI", "AUTH_SECRET", "JWT_SECRET", "JWT_REFRESH_SECRET", "TENANT_SECRETS_KEY"]) {
      if (!source[name]?.trim()) errors.push(`${name} is required in production.`);
    }
  }

  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push("JWT_SECRET and JWT_REFRESH_SECRET must be different.");
  }

  for (const legacy of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_PASSWORD_HASH"]) {
    if (env[legacy]) {
      warnings.push(`${legacy} is no longer read: payment keys and admin accounts are configured per store (see README).`);
    }
  }
  if (partiallySet(["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"], env)) {
    errors.push("Set all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or none.");
  }
  if (partiallySet(["RESEND_API_KEY", "NOTIFY_EMAIL_FROM"], env)) {
    warnings.push("Email needs both RESEND_API_KEY and NOTIFY_EMAIL_FROM (a sender on your verified domain).");
  }
  if (!env.MONGODB_URI && !isProduction) {
    warnings.push("MONGODB_URI is not set; stores cannot be served until it is configured.");
  }

  return { errors, warnings };
}

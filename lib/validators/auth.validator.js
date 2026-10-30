import { z } from "zod";
import { ROLES } from "@/lib/constants/roles";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: passwordSchema,
  phone: z.string().trim().max(25).optional().or(z.literal("")),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  gstNumber: z.string().trim().max(20).optional().or(z.literal("")),
  role: z.enum([ROLES.CUSTOMER]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export function formatZodErrors(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}

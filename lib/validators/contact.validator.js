import { z } from "zod";

export const contactMessageSchema = z.object({
  name: z
    .string({ error: "Enter a name between 2 and 100 characters." })
    .trim()
    .min(2, "Enter a name between 2 and 100 characters.")
    .max(100, "Enter a name between 2 and 100 characters."),
  email: z
    .string({ error: "Enter a valid email address." })
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid email address.")
    .email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d().\s-]{7,25}$/, "Enter a valid phone number or leave this blank.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  subject: z
    .string({ error: "Enter a subject between 3 and 120 characters." })
    .trim()
    .min(3, "Enter a subject between 3 and 120 characters.")
    .max(120, "Enter a subject between 3 and 120 characters."),
  message: z
    .string({ error: "Your message must be between 20 and 5,000 characters." })
    .trim()
    .min(20, "Your message must be between 20 and 5,000 characters.")
    .max(5000, "Your message must be between 20 and 5,000 characters."),
  // Honeypot: real visitors never fill this hidden field.
  website: z.string().max(0).optional(),
});

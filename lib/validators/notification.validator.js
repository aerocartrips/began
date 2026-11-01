import { z } from "zod";
import { NOTIFICATION_LIMITS } from "@/lib/constants/notifications";

export const listNotificationsQuerySchema = z.object({
  cursor: z
    .string()
    .trim()
    .max(80)
    .regex(/^[A-Za-z0-9_-]*$/, "Invalid cursor.")
    .optional()
    .transform((value) => value || null),
  limit: z.coerce.number().int().min(1).max(NOTIFICATION_LIMITS.pageMax).default(NOTIFICATION_LIMITS.pageDefault),
  unread: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((value) => value === "1" || value === "true"),
}).transform(({ unread, ...rest }) => ({ ...rest, unreadOnly: unread }));

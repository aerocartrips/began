"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { setContactMessageStatus } from "@/features/messages/service/contact-messages";
import type { ContactMessage } from "@/features/messages/types/contact-message";

export async function updateContactMessageStatus(
  messageId: string,
  status: ContactMessage["status"],
) {
  await requireAdmin();
  if (!/^[\da-f-]{36}$/i.test(messageId)) return { ok: false as const };
  if (!["new", "read", "archived"].includes(status)) return { ok: false as const };

  const updated = await setContactMessageStatus(messageId, status);
  if (!updated) return { ok: false as const };
  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${messageId}`);
  return { ok: true as const };
}
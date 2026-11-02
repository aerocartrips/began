import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { getAuthUser } from "@/lib/auth/session";
import { withCurrentTenant } from "@/lib/tenant/current";

/** Session user for Server Components, read once per request. */
export const getCurrentAccountUser = cache(async () => {
  if (!isDatabaseConfigured()) return null;
  await connectDB();
  return withCurrentTenant(() => getAuthUser());
});

export async function requireAccountUser(next = "/account") {
  const user = await getCurrentAccountUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return user;
}

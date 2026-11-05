import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { readSession } from "@/lib/auth/session";
import { authHref } from "@/lib/auth/redirect";
import { withCurrentTenant } from "@/lib/tenant/current";

type CurrentSession = Awaited<ReturnType<typeof readSession>>;

const SIGNED_OUT: CurrentSession = { user: null, status: "anonymous" };

/**
 * Session for Server Components, read once per request: the header and the
 * page share a single cookie check and user lookup.
 */
export const getCurrentSession = cache(async (): Promise<CurrentSession> => {
  if (!isDatabaseConfigured()) return SIGNED_OUT;
  await connectDB();
  return withCurrentTenant(() => readSession());
});

export async function getCurrentAccountUser() {
  return (await getCurrentSession()).user;
}

export async function requireAccountUser(next = "/account") {
  const user = await getCurrentAccountUser();
  if (!user) redirect(authHref(next));
  return user;
}

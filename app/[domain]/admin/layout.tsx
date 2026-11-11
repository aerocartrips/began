import type { ReactNode } from "react";
import { ROBOTS_PRIVATE } from "@/lib/seo/robots";

/** The admin is never indexed (robots.txt also keeps crawlers out of /admin). */
export const metadata = { robots: ROBOTS_PRIVATE };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
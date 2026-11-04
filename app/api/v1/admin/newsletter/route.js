import { PERMISSIONS } from "@/lib/auth/permissions";
import { withDatabase } from "@/lib/api/with-database";
import { successResponse } from "@/lib/utils/api-response";
import { requireAdminAccess } from "@/lib/auth/admin-access";
import { exportSubscribersCsv, listNewsletterSubscribers } from "@/lib/services/newsletter.service";

/** Subscriber list, or confirmed subscribers as CSV with `?format=csv`. */
export const GET = withDatabase(async (request) => {
  await requireAdminAccess(PERMISSIONS.MARKETING_MANAGE);
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get("format") === "csv") {
    return new Response(await exportSubscribersCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="newsletter-subscribers.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const { items, meta } = await listNewsletterSubscribers(searchParams);
  return successResponse(items, "Subscribers fetched.", meta);
});

import { AdminGuideEdit } from "@/components/admin/admin-guides-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const metadata = { title: "Edit guide | Admin" };

export default async function EditAdminGuidePage({ params }: { params: Promise<{ guideId: string }> }) {
  await guardAdminPage(PERMISSIONS.MARKETING_MANAGE);
  const { guideId } = await params;
  return <AdminGuideEdit guideId={guideId} />;
}

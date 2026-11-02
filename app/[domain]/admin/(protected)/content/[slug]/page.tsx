import { notFound } from "next/navigation";
import { AdminPageEditor } from "@/components/admin/admin-staff-content-client";
import { guardAdminPage } from "@/lib/admin/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { STORE_PAGES } from "@/lib/content/store-pages";

export const metadata = { title: "Edit page | Admin" };

export default async function AdminPageEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  await guardAdminPage(PERMISSIONS.SETTINGS_MANAGE);
  const { slug } = await params;
  if (!(slug in STORE_PAGES)) notFound();
  return <AdminPageEditor slug={slug} />;
}

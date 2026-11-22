import AttributeLibraryClient from "@/components/admin/attribute-library-client";
import { loadAdminCatalog } from "@/lib/admin/catalog-data";

export const metadata = { title: "Attributes | Admin" };

export default async function AdminAttributesPage() {
  const { attributes } = await loadAdminCatalog();
  return <AttributeLibraryClient attributes={attributes} />;
}

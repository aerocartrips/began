import { Suspense, type ReactNode } from "react";
import AdminShell from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";

type ProtectedAdminLayoutProps = {
  children: ReactNode;
};

async function AuthenticatedAdminShell({ children }: ProtectedAdminLayoutProps) {
  const session = await requireAdmin();
  return <AdminShell email={session.email}>{children}</AdminShell>;
}

export default function ProtectedAdminLayout({ children }: ProtectedAdminLayoutProps) {
  return (
    <Suspense fallback={<div className="admin-auth-loading" role="status">Checking administrator session...</div>}>
      <AuthenticatedAdminShell>{children}</AuthenticatedAdminShell>
    </Suspense>
  );
}
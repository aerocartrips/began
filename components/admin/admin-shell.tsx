import type { ReactNode } from "react";
import AdminHeader from "@/components/admin/admin-header";
import AdminSidebar from "@/components/admin/admin-sidebar";
import AdminFeedbackRoot from "@/components/admin/admin-feedback-root";
import { AdminSessionProvider } from "@/components/admin/admin-session-provider";

type AdminShellProps = {
  email: string;
  permissions: string[];
  children: ReactNode;
};

export default function AdminShell({ email, permissions, children }: AdminShellProps) {
  return (
    <AdminSessionProvider permissions={permissions}>
    <AdminFeedbackRoot>
      <div className="admin-workspace">
        <AdminSidebar />
        <div className="admin-main">
          <AdminHeader email={email} />
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </AdminFeedbackRoot>
    </AdminSessionProvider>
  );
}
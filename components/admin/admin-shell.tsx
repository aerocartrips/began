import type { ReactNode } from "react";
import AdminHeader from "@/components/admin/admin-header";
import AdminSidebar from "@/components/admin/admin-sidebar";
import AdminFeedbackRoot from "@/components/admin/admin-feedback-root";

type AdminShellProps = {
  email: string;
  children: ReactNode;
};

export default function AdminShell({ email, children }: AdminShellProps) {
  return (
    <AdminFeedbackRoot>
      <div className="admin-workspace">
        <AdminSidebar />
        <div className="admin-main">
          <AdminHeader email={email} />
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </AdminFeedbackRoot>
  );
}
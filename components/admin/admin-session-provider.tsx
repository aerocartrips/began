"use client";

import { createContext, useContext, type ReactNode } from "react";

const AdminPermissionsContext = createContext<ReadonlySet<string>>(new Set());

export function AdminSessionProvider({ permissions, children }: { permissions: string[]; children: ReactNode }) {
  return (
    <AdminPermissionsContext.Provider value={new Set(permissions)}>{children}</AdminPermissionsContext.Provider>
  );
}

/** UI hint only; every admin API route enforces permissions on the server. */
export function useAdminCan(permission?: string) {
  const permissions = useContext(AdminPermissionsContext);
  return !permission || permissions.has(permission);
}

export function useAdminPermissions() {
  return useContext(AdminPermissionsContext);
}

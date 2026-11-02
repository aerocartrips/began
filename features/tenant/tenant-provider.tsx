"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicTenant, SalesMode } from "@/lib/tenant/types";

/** The subset of store configuration client components may read. */
export type ClientTenant = {
  name: string;
  siteTitle: string;
  logoUrl: string;
  salesMode: SalesMode;
  /** Online payments are configured for this store. */
  paymentsEnabled: boolean;
  contact: PublicTenant["contact"];
};

const TenantContext = createContext<ClientTenant | null>(null);

export function TenantProvider({ tenant, children }: { tenant: ClientTenant; children: ReactNode }) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const tenant = useContext(TenantContext);
  if (!tenant) throw new Error("useTenant() must be used inside <TenantProvider>.");
  return tenant;
}

export function useSalesMode() {
  return useTenant().salesMode;
}

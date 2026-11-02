import { ADMIN_ROLES } from "@/lib/constants/roles";

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  CATALOG_MANAGE: "catalog:manage",
  ORDERS_MANAGE: "orders:manage",
  PAYMENTS_REFUND: "payments:refund",
  CUSTOMERS_MANAGE: "customers:manage",
  REVIEWS_MODERATE: "reviews:moderate",
  SUPPORT_MANAGE: "support:manage",
  RETURNS_MANAGE: "returns:manage",
  QUOTES_MANAGE: "quotes:manage",
  JOBS_RUN: "jobs:run",
  SETTINGS_MANAGE: "settings:manage",
  STAFF_MANAGE: "staff:manage",
};

const ALL = Object.values(PERMISSIONS);

const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.OWNER]: new Set(ALL),
  [ADMIN_ROLES.MANAGER]: new Set(
    ALL.filter((permission) => permission !== PERMISSIONS.SETTINGS_MANAGE && permission !== PERMISSIONS.STAFF_MANAGE),
  ),
  [ADMIN_ROLES.STAFF]: new Set([
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.REVIEWS_MODERATE,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.RETURNS_MANAGE,
    PERMISSIONS.QUOTES_MANAGE,
  ]),
};

/**
 * @param {string | undefined} adminRole
 * @param {string} permission
 */
export function roleHasPermission(adminRole, permission) {
  return ROLE_PERMISSIONS[adminRole]?.has(permission) ?? false;
}

/** @param {string | undefined} adminRole */
export function permissionsForRole(adminRole) {
  return [...(ROLE_PERMISSIONS[adminRole] ?? [])];
}

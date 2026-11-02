export const ROLES = {
  CUSTOMER: "customer",
  ADMIN: "admin",
};

export const ROLE_VALUES = Object.values(ROLES);

/** Staff level of a `role: "admin"` user within their store. */
export const ADMIN_ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  STAFF: "staff",
};

export const ADMIN_ROLE_VALUES = Object.values(ADMIN_ROLES);

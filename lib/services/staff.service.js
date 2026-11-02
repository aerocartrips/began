import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ApiError } from "@/lib/utils/api-error";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { User } from "@/lib/db/models/User";
import { ADMIN_ROLES, ADMIN_ROLE_VALUES, ROLES } from "@/lib/constants/roles";

const STAFF_FIELDS = "name email adminRole isActive lastLoginAt createdAt";

const toStaff = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  adminRole: user.adminRole,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt,
});

const parse = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const errors = formatZodErrors(parsed.error);
    throw new ApiError(422, errors[0]?.message ?? "Validation failed.", errors);
  }
  return parsed.data;
};

export async function listStaff() {
  const staff = await User.find({ role: ROLES.ADMIN }).sort({ adminRole: 1, name: 1 }).select(STAFF_FIELDS).lean();
  return staff.map(toStaff);
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  adminRole: z.enum(ADMIN_ROLE_VALUES),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
});

/**
 * Creates a staff account with an initial password the owner shares privately.
 * An existing customer with the same email is not converted (separate accounts).
 */
export async function createStaff(payload) {
  const data = parse(createSchema, payload);
  if (await User.exists({ email: data.email })) {
    throw new ApiError(409, "An account with this email already exists in this store.");
  }
  const user = await User.create({
    name: data.name,
    email: data.email,
    password: await bcrypt.hash(data.password, 12),
    role: ROLES.ADMIN,
    adminRole: data.adminRole,
    isActive: true,
  });
  return toStaff(user);
}

const updateSchema = z.object({ adminRole: z.enum(ADMIN_ROLE_VALUES).optional(), isActive: z.boolean().optional() });

/** Changing role or deactivating signs the account out everywhere. The last active owner is protected. */
export async function updateStaff(actor, userId, payload) {
  const data = parse(updateSchema, payload);
  if (!mongoose.isValidObjectId(userId)) throw new ApiError(404, "Staff member not found.");
  const user = await User.findOne({ _id: userId, role: ROLES.ADMIN });
  if (!user) throw new ApiError(404, "Staff member not found.");
  if (String(user._id) === String(actor._id) && (data.isActive === false || (data.adminRole && data.adminRole !== user.adminRole))) {
    throw new ApiError(409, "You cannot change your own role or deactivate yourself.");
  }

  const losesOwner =
    user.adminRole === ADMIN_ROLES.OWNER &&
    user.isActive &&
    ((data.adminRole && data.adminRole !== ADMIN_ROLES.OWNER) || data.isActive === false);
  if (losesOwner) {
    const otherOwners = await User.countDocuments({ role: ROLES.ADMIN, adminRole: ADMIN_ROLES.OWNER, isActive: true, _id: { $ne: user._id } });
    if (otherOwners === 0) throw new ApiError(409, "The store needs at least one active owner.");
  }

  if (data.adminRole) user.adminRole = data.adminRole;
  if (data.isActive !== undefined) user.isActive = data.isActive;
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
  return toStaff(user);
}

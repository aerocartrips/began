import bcrypt from "bcryptjs";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { ROLES } from "@/lib/constants/roles";

/**
 * Verifies MongoDB admin credentials for unified admin sign-in.
 * @param {string} email
 * @param {string} password
 */
export async function verifyDatabaseAdminCredentials(email, password) {
  if (!isDatabaseConfigured()) return null;

  await connectDB();
  const normalizedEmail = email.trim().toLowerCase();
  const adminUser = await User.findOne({
    email: normalizedEmail,
    role: ROLES.ADMIN,
    isActive: true,
  }).select("+password");

  if (!adminUser?.password) return null;

  const matches = await bcrypt.compare(password, adminUser.password);
  if (!matches) return null;

  return { email: adminUser.email };
}

/**
 * Validates that an admin session email still belongs to an active MongoDB admin.
 * @param {string} email
 */
export async function verifyDatabaseAdminSessionEmail(email) {
  if (!isDatabaseConfigured()) return null;

  await connectDB();
  const adminUser = await User.findOne({
    email: email.trim().toLowerCase(),
    role: ROLES.ADMIN,
    isActive: true,
  }).select("email");

  if (!adminUser) return null;
  return { email: adminUser.email };
}

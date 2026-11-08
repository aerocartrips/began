import { ApiError } from "@/lib/utils/api-error";
import { BCRYPT_ROUNDS, hashPassword, verifyPassword } from "@/lib/auth/password";
import { ROLES } from "@/lib/constants/roles";
import { toPublicUser } from "@/lib/db/models/User";
import { userRepository } from "@/lib/repositories/user.repository";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/session";
import { registerSchema, loginSchema, formatZodErrors } from "@/lib/validators/auth.validator";

export { BCRYPT_ROUNDS };

export async function registerUser(payload) {
  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  const existing = await userRepository.findByEmail(parsed.data.email);
  if (existing) {
    throw new ApiError(409, "An account with this email already exists.", [
      { field: "email", message: "Email is already registered." },
    ]);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [firstName, ...rest] = parsed.data.name.split(/\s+/);
  const user = await userRepository.create({
    name: parsed.data.name,
    firstName,
    lastName: rest.join(" "),
    email: parsed.data.email.toLowerCase(),
    password: passwordHash,
    phone: parsed.data.phone || "",
    companyName: parsed.data.companyName || "",
    gstNumber: parsed.data.gstNumber || "",
    role: ROLES.CUSTOMER,
  });

  await setAuthCookies(user);
  return toPublicUser(user);
}

export async function loginUser(payload) {
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }

  // Storefront sign-in is for customers; staff use the admin sign-in. Any other
  // account gets the same answer, in the same time, as a wrong password.
  const user = await userRepository.findCustomerByEmail(parsed.data.email);
  const passwordMatches = await verifyPassword(parsed.data.password, user?.isActive ? user.password : null);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  user.lastLoginAt = new Date();
  await Promise.all([setAuthCookies(user), userRepository.touchLastLogin(user._id, user.lastLoginAt)]);
  return toPublicUser(user);
}

export async function logoutUser() {
  await clearAuthCookies();
}

export async function getCurrentUser(user) {
  return toPublicUser(user);
}

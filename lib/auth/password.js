import bcrypt from "bcryptjs";

export const BCRYPT_ROUNDS = 12;

/**
 * A valid hash of a random password. Verifying against it when no account
 * matches keeps sign-in timing the same either way, so response times do not
 * reveal which emails have accounts.
 */
const DUMMY_HASH = "$2b$12$.f1Xdk2He.Br0HHwaiO1PO6mWaUmBKpLtKl5fq1B9yVnxjUPMYLxS";

/** @param {string} password */
export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Whether `password` matches `hash`. Always performs one bcrypt comparison,
 * also when there is no hash (unknown or ineligible account).
 * @param {string} password
 * @param {string | null | undefined} hash
 */
export async function verifyPassword(password, hash) {
  const matches = await bcrypt.compare(password, hash || DUMMY_HASH);
  return Boolean(hash) && matches;
}

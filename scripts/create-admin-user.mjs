/**
 * Creates or updates a MongoDB admin user for /api/v1 auth.
 *
 * Usage:
 *   node scripts/create-admin-user.mjs admin@norosilk.com "StrongPassword123!" "Norosilk Admin"
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const [, , emailArg, passwordArg, nameArg] = process.argv;

if (!emailArg || !passwordArg) {
  process.stderr.write(
    "Usage: node scripts/create-admin-user.mjs <email> <password> [name]\n",
  );
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI?.trim();
if (!MONGODB_URI) {
  process.stderr.write("Set MONGODB_URI before running this script.\n");
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true },
    password: String,
    role: { type: String, default: "customer" },
    isActive: { type: Boolean, default: true },
    companyName: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    phone: { type: String, default: "" },
    isEmailVerified: { type: Boolean, default: false },
    addresses: { type: Array, default: [] },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

await mongoose.connect(MONGODB_URI);
const email = emailArg.trim().toLowerCase();
const passwordHash = await bcrypt.hash(passwordArg, 12);
const name = nameArg?.trim() || "Admin User";

const existing = await User.findOne({ email });
if (existing) {
  existing.password = passwordHash;
  existing.role = "admin";
  existing.isActive = true;
  existing.name = name;
  await existing.save();
  process.stdout.write(`Updated admin user: ${email}\n`);
} else {
  await User.create({
    name,
    email,
    password: passwordHash,
    role: "admin",
    isActive: true,
  });
  process.stdout.write(`Created admin user: ${email}\n`);
}

await mongoose.disconnect();

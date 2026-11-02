/**
 * Creates or updates a staff account for one store.
 *
 *   ADMIN_PASSWORD='…' npm run admin:create -- --tenant acme --email ops@acme.example.com --role manager
 *
 * Roles: owner, manager, staff (see lib/auth/permissions.js). The password is
 * read from ADMIN_PASSWORD so it never appears in shell history.
 */
import bcrypt from "bcryptjs";
import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { User } from "@/lib/db/models/User";
import { runWithTenant } from "@/lib/tenant/context";
import { ADMIN_ROLE_VALUES, ROLES } from "@/lib/constants/roles";

const USAGE = "Usage: ADMIN_PASSWORD=… npm run admin:create -- --tenant <slug> --email <email> [--name <name>] [--role owner|manager|staff]";

const args = parseCli(
  {
    tenant: { type: "string" },
    email: { type: "string" },
    name: { type: "string", default: "Store Admin" },
    role: { type: "string", default: "staff" },
  },
  USAGE,
);
if (args.help || !args.tenant || !args.email) fail(USAGE);
if (!ADMIN_ROLE_VALUES.includes(args.role)) fail(`--role must be one of ${ADMIN_ROLE_VALUES.join(", ")}.`);
const password = process.env.ADMIN_PASSWORD ?? "";
if (password.length < 12) fail("Set ADMIN_PASSWORD (12+ characters).");

await connect();
const tenant = await Tenant.findOne({ slug: args.tenant }).lean();
if (!tenant) fail(`No store with slug "${args.tenant}".`);

await runWithTenant(String(tenant._id), async () => {
  const email = args.email.trim().toLowerCase();
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: { role: ROLES.ADMIN, adminRole: args.role, isActive: true, password: await bcrypt.hash(password, 12) },
      $setOnInsert: { name: args.name, email },
      // Signs out existing sessions for this account.
      $inc: { sessionVersion: 1 },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
  process.stdout.write(`${args.role} account ready for ${tenant.slug}: ${user.email}\n`);
});

await disconnect();

/**
 * Creates (or updates) a store and its owner account.
 *
 *   npm run tenant:create -- --slug acme --name "Acme Silks" --domain acme.example.com \
 *     --domain www.acme.example.com --sales-mode wholesale --owner-email owner@acme.example.com
 *
 * The owner password is read from the OWNER_PASSWORD environment variable so it
 * never appears in shell history. Re-running with the same slug updates the
 * store's name, domains and sales mode.
 */
import bcrypt from "bcryptjs";
import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { User } from "@/lib/db/models/User";
import { runWithTenant } from "@/lib/tenant/context";
import { normalizeHost } from "@/lib/tenant/host";
import { SALES_MODE_VALUES } from "@/lib/constants/sales-mode";
import { ADMIN_ROLES, ROLES } from "@/lib/constants/roles";

const USAGE = "Usage: npm run tenant:create -- --slug <slug> --name <name> --domain <host> [--domain <host>] [--sales-mode wholesale|retail] [--owner-email <email>] [--owner-name <name>]";

const args = parseCli(
  {
    slug: { type: "string" },
    name: { type: "string" },
    domain: { type: "string", multiple: true },
    "sales-mode": { type: "string", default: "wholesale" },
    "owner-email": { type: "string" },
    "owner-name": { type: "string", default: "Store Owner" },
  },
  USAGE,
);
if (args.help || !args.slug || !args.name || !args.domain?.length) fail(USAGE);
if (!SALES_MODE_VALUES.includes(args["sales-mode"])) fail(`--sales-mode must be one of ${SALES_MODE_VALUES.join(", ")}.`);

const domains = args.domain.map((domain) => normalizeHost(domain) ?? fail(`Invalid domain: ${domain}`));

await connect();
const tenant = await Tenant.findOneAndUpdate(
  { slug: args.slug },
  {
    $set: { name: args.name, domains, salesMode: args["sales-mode"] },
    $setOnInsert: { slug: args.slug, status: "active", "branding.siteTitle": args.name },
  },
  { upsert: true, returnDocument: "after", runValidators: true },
);
process.stdout.write(`Store "${tenant.slug}" (${tenant._id}) serves: ${tenant.domains.join(", ")}\n`);

if (args["owner-email"]) {
  const password = process.env.OWNER_PASSWORD ?? "";
  if (password.length < 12) fail("Set OWNER_PASSWORD (12+ characters) to create the owner account.");
  await runWithTenant(String(tenant._id), async () => {
    const email = args["owner-email"].trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const owner = await User.findOneAndUpdate(
      { email },
      {
        $set: { role: ROLES.ADMIN, adminRole: ADMIN_ROLES.OWNER, isActive: true, password: passwordHash },
        $setOnInsert: { name: args["owner-name"], email },
        $inc: { sessionVersion: 1 },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    process.stdout.write(`Owner account ready: ${owner.email}\n`);
  });
}

await disconnect();

/**
 * Stores a store's integration credentials, encrypted with TENANT_SECRETS_KEY.
 * Values come from environment variables (never CLI flags); unset ones are left unchanged.
 *
 *   RAZORPAY_KEY_ID=… RAZORPAY_KEY_SECRET=… RAZORPAY_WEBHOOK_SECRET=… \
 *   DELHIVERY_API_TOKEN=… DELHIVERY_B2B_USERNAME=… DELHIVERY_B2B_PASSWORD=… \
 *   npm run tenant:integrations -- --tenant acme
 */
import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { encryptSecret } from "@/lib/tenant/secrets";

const args = parseCli({ tenant: { type: "string" } }, "Usage: npm run tenant:integrations -- --tenant <slug>");
if (!args.tenant) fail("--tenant is required.");

const env = (name) => process.env[name]?.trim() || undefined;
const updates = Object.fromEntries(
  Object.entries({
    "integrations.razorpay.keyId": env("RAZORPAY_KEY_ID"),
    "integrations.razorpay.keySecret": env("RAZORPAY_KEY_SECRET") && encryptSecret(env("RAZORPAY_KEY_SECRET")),
    "integrations.razorpay.webhookSecret": env("RAZORPAY_WEBHOOK_SECRET") && encryptSecret(env("RAZORPAY_WEBHOOK_SECRET")),
    "integrations.delhivery.apiToken": env("DELHIVERY_API_TOKEN") && encryptSecret(env("DELHIVERY_API_TOKEN")),
    "integrations.delhivery.b2bUsername": env("DELHIVERY_B2B_USERNAME"),
    "integrations.delhivery.b2bPassword": env("DELHIVERY_B2B_PASSWORD") && encryptSecret(env("DELHIVERY_B2B_PASSWORD")),
  }).filter(([, value]) => value !== undefined),
);
if (!Object.keys(updates).length) fail("No integration variables were set; nothing to update.");

await connect();
const result = await Tenant.updateOne({ slug: args.tenant }, { $set: updates });
if (!result.matchedCount) fail(`No store with slug "${args.tenant}".`);
process.stdout.write(`Updated ${Object.keys(updates).length} setting(s) for ${args.tenant}: ${Object.keys(updates).join(", ")}\n`);
await disconnect();

/**
 * One-time catalogue upgrade to product types and the attribute library
 * (lib/services/catalog-upgrade.service.js): the store's products without a
 * type become a "Saree" type, with their fabric, weave, occasion, pattern,
 * length and blouse-piece details and colour variants carried over.
 *
 *   npm run catalog:upgrade -- --tenant <slug>            # dry run: what would change
 *   npm run catalog:upgrade -- --tenant <slug> --apply    # write the changes
 *
 * With --apply it also rebuilds the catalogue indexes whose definition changed
 * (full-text search over detail values; stock alerts per variant). Safe to
 * re-run: only products still without a type are touched.
 *
 * A script can't clear a running site's page cache, so a deployed store shows
 * the upgrade within the hour (or at its next catalogue save). Admin →
 * Product types → "Upgrade catalogue" does the same and refreshes at once.
 */

import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { runWithTenant } from "@/lib/tenant/context";
import { ensureCatalogIndexes, upgradeLegacyCatalog } from "@/lib/services/catalog-upgrade.service";

const args = parseCli(
  { tenant: { type: "string" }, apply: { type: "boolean" } },
  "Usage: npm run catalog:upgrade -- --tenant <slug> [--apply]",
);
if (!args.tenant) fail("--tenant is required.");

await connect();
const tenant = await Tenant.findOne({ slug: args.tenant }).lean();
if (!tenant) fail(`No store with slug "${args.tenant}".`);
const apply = Boolean(args.apply);

const result = await runWithTenant(String(tenant._id), () => upgradeLegacyCatalog({ apply }));
const line = (label, value) => process.stdout.write(`${label.padEnd(36)} ${value}\n`);

process.stdout.write(`\n${apply ? "Upgraded" : "Dry run for"} ${tenant.name} (${tenant.slug})\n\n`);
line("Products without a type", result.products);
if (apply) line("Products converted", result.converted);
line("Variants given a Colour option", result.variants);
line("Colour photo groups", result.colourPhotoGroups);
line(`Product type "${result.type.name}"`, `${result.type.status} (/shop/${result.type.slug})`);
line("Values in the old attribute lists", result.oldListValues);
process.stdout.write("\nAttribute library\n");
for (const attribute of result.attributes) {
  line(`  ${attribute.name} (${attribute.key})`, `${attribute.status}: ${attribute.values} values${attribute.added ? `, ${attribute.added} added` : ""}`);
}

if (apply) {
  await ensureCatalogIndexes();
  process.stdout.write("\nCatalogue indexes are up to date.\n");
  process.stdout.write(
    "A running site keeps its cached catalogue pages for up to an hour, or until the next catalogue save in the admin.\n" +
      '(Admin → Product types → "Upgrade catalogue" refreshes them at once.)\n',
  );
} else {
  process.stdout.write("\nNothing was written. Run again with --apply to upgrade.\n");
}
await disconnect();

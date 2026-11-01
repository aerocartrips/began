/**
 * One-off import of contact messages from the retired JSON store into the
 * MongoDB support inbox. Safe to re-run: entries are matched on legacyContactId.
 *
 * Usage:
 *   node --env-file=.env scripts/import-legacy-contact-messages.mjs [path/to/contact-messages.json]
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI?.trim();
if (!MONGODB_URI) {
  process.stderr.write("Set MONGODB_URI before running this script.\n");
  process.exit(1);
}

const storePath = resolve(
  process.argv[2] ?? process.env.CONTACT_MESSAGES_FILE ?? ".data/contact-messages.json",
);

function mapLegacyStatus(status) {
  if (status === "archived") return "closed";
  if (status === "read") return "resolved";
  return "open";
}

let entries;
try {
  entries = JSON.parse(await readFile(storePath, "utf8"));
} catch (error) {
  if (error?.code === "ENOENT") {
    process.stdout.write(`No legacy store found at ${storePath}; nothing to import.\n`);
    process.exit(0);
  }
  throw error;
}
if (!Array.isArray(entries)) {
  process.stderr.write(`${storePath} does not contain a JSON array.\n`);
  process.exit(1);
}

await mongoose.connect(MONGODB_URI, { bufferCommands: false });
const conversations = mongoose.connection.collection("supportconversations");
const messages = mongoose.connection.collection("supportmessages");

let imported = 0;
let skipped = 0;
for (const entry of entries) {
  if (!entry?.id) continue;
  if (await conversations.findOne({ legacyContactId: entry.id }, { projection: { _id: 1 } })) {
    skipped += 1;
    continue;
  }

  const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
  const { insertedId } = await conversations.insertOne({
    guestName: entry.name ?? "Guest",
    guestEmail: String(entry.email ?? "").toLowerCase(),
    subject: entry.subject ?? "Contact form",
    order: null,
    status: mapLegacyStatus(entry.status),
    priority: "normal",
    assignedAdmin: null,
    internalNotes: "",
    lastMessageAt: createdAt,
    unreadByAdmin: entry.status === "new" ? 1 : 0,
    unreadByCustomer: 0,
    legacyContactId: entry.id,
    createdAt,
    updatedAt: createdAt,
  });

  await messages.insertOne({
    conversation: insertedId,
    sender: null,
    senderRole: "customer",
    body: [entry.message, entry.phone ? `Phone: ${entry.phone}` : ""].filter(Boolean).join("\n"),
    readByAdmin: entry.status !== "new",
    readByCustomer: true,
    legacyImported: true,
    createdAt,
  });
  imported += 1;
}

await mongoose.disconnect();
process.stdout.write(`Imported ${imported} message(s), skipped ${skipped} already imported.\n`);

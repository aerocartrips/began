import { parseArgs } from "node:util";
import mongoose from "mongoose";

/**
 * @param {import("node:util").ParseArgsConfig["options"]} options
 * @param {string} usage
 */
export function parseCli(options, usage) {
  try {
    return parseArgs({ options: { ...options, help: { type: "boolean" } }, allowPositionals: false }).values;
  } catch (error) {
    fail(`${error.message}\n\n${usage}`);
  }
}

export function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

export async function connect() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) fail("Set MONGODB_URI before running this script.");
  await mongoose.connect(uri, { bufferCommands: false });
}

export async function disconnect() {
  await mongoose.disconnect();
}

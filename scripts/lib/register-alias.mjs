/**
 * Lets operator scripts import application modules ("@/lib/...") with plain Node:
 *   node --import ./scripts/lib/register-alias.mjs scripts/<script>.mjs
 * Maps "@/" to the project root and resolves extensionless paths the way the
 * Next.js bundler does, so scripts reuse the real models and tenant plugin.
 */
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);

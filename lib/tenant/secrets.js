import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey() {
  const raw = process.env.TENANT_SECRETS_KEY?.trim();
  if (!raw) throw new Error("TENANT_SECRETS_KEY is not configured.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TENANT_SECRETS_KEY must be 32 bytes, base64-encoded.");
  return key;
}

/**
 * Encrypts a tenant integration secret for storage. Format: v1:iv:tag:ciphertext (base64url).
 * @param {string} plaintext
 */
export function encryptSecret(plaintext) {
  if (!plaintext) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext].map((part) =>
    typeof part === "string" ? part : part.toString("base64url"),
  ).join(":");
}

/**
 * @param {string | undefined | null} payload
 */
export function decryptSecret(payload) {
  if (!payload) return "";
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unrecognised tenant secret format.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

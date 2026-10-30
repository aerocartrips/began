import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import type { ContactMessage, ContactMessageInput } from "@/features/messages/types/contact-message";

const storePath = process.env.CONTACT_MESSAGES_FILE
  ? isAbsolute(process.env.CONTACT_MESSAGES_FILE)
    ? process.env.CONTACT_MESSAGES_FILE
    : resolve(process.cwd(), process.env.CONTACT_MESSAGES_FILE)
  : resolve(process.cwd(), ".data", "contact-messages.json");

let writeQueue: Promise<void> = Promise.resolve();

async function readAll(): Promise<ContactMessage[]> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Invalid contact message store format.");
    return parsed as ContactMessage[];
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeAll(messages: ContactMessage[]) {
  await mkdir(dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(messages, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, storePath);
}

async function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  await writeQueue;
  return (await readAll()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getContactMessage(id: string): Promise<ContactMessage | null> {
  const messages = await listContactMessages();
  return messages.find((message) => message.id === id) ?? null;
}

export async function createContactMessage(input: ContactMessageInput): Promise<ContactMessage> {
  return withWriteLock(async () => {
    const messages = await readAll();
    const message: ContactMessage = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      readAt: null,
      status: "new",
    };
    await writeAll([message, ...messages]);
    return message;
  });
}

export async function setContactMessageStatus(
  id: string,
  status: ContactMessage["status"],
): Promise<boolean> {
  return withWriteLock(async () => {
    const messages = await readAll();
    const index = messages.findIndex((message) => message.id === id);
    if (index < 0) return false;
    const current = messages[index];
    messages[index] = {
      ...current,
      status,
      readAt: status === "read" ? new Date().toISOString() : status === "new" ? null : current.readAt,
    };
    await writeAll(messages);
    return true;
  });
}
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI?.trim();

/** @type {{ conn: typeof mongoose | null, promise: Promise<typeof mongoose> | null }} */
const globalCache = globalThis.__norosilkMongoose ?? { conn: null, promise: null };
globalThis.__norosilkMongoose = globalCache;

export function isDatabaseConfigured() {
  return Boolean(MONGODB_URI);
}

export async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (globalCache.conn) {
    return globalCache.conn;
  }

  if (!globalCache.promise) {
    globalCache.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
      })
      .catch((error) => {
        // Forget the failed attempt so the next request reconnects instead of
        // re-awaiting this rejected promise until the process restarts.
        globalCache.promise = null;
        throw error;
      });
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}

export async function disconnectDB() {
  if (globalCache.conn) {
    await mongoose.disconnect();
    globalCache.conn = null;
    globalCache.promise = null;
  }
}

export function getConnectionState() {
  return mongoose.connection.readyState;
}

import mongoose from "mongoose";

/**
 * Runs `work(session)` in a MongoDB transaction and returns its result.
 *
 * The whole callback is retried on transient errors (write conflicts with a
 * concurrent writer, primary elections) and on an unknown commit result, so
 * read-validate-write sequences inside it never act on a stale read. Because it
 * can run more than once, `work` must only touch the database: send emails,
 * notifications and payment-provider calls after this resolves.
 * @template T
 * @param {(session: import("mongoose").ClientSession) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    /** @type {T} */
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

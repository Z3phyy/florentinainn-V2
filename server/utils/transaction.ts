import mongoose, { ClientSession } from "mongoose";

let transactionsSupported: boolean | null = null;

async function supportsTransactions(): Promise<boolean> {
  if (transactionsSupported !== null) return transactionsSupported;
  try {
    const db = mongoose.connection.db;
    if (!db) return false;
    const hello = await db.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName || hello.msg === "isdbgrid");
  } catch {
    transactionsSupported = false;
  }
  return transactionsSupported;
}

export async function runAtomic<T>(work: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (!(await supportsTransactions())) {
    return work(undefined);
  }
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

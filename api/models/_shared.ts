import type { Db } from "mongodb";

type GlobalMongoModelState = {
  __mongoModelIndexesReady?: Set<string>;
};

const globalModelState = globalThis as typeof globalThis & GlobalMongoModelState;

function getIndexReadySet() {
  if (!globalModelState.__mongoModelIndexesReady) {
    globalModelState.__mongoModelIndexesReady = new Set<string>();
  }
  return globalModelState.__mongoModelIndexesReady;
}

/**
 * Ensures indexes are created once per runtime instance.
 * This avoids repeated index calls during hot reloads in development.
 */
export async function ensureIndexesOnce(
  db: Db,
  key: string,
  create: (db: Db) => Promise<void>
) {
  const ready = getIndexReadySet();
  if (ready.has(key)) return;
  await create(db);
  ready.add(key);
}

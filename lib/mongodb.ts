import { MongoClient, Db } from "mongodb";

/**
 * Global cache for serverless + dev hot-reload safety.
 * Prevents opening excess Mongo connections across module reloads.
 */
const globalForMongo = globalThis as typeof globalThis & {
  __mongoClientPromise?: Promise<MongoClient>;
  __mongoPoolAttached?: boolean;
};

function getMongoEnv() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Pull envs with `vercel env pull .env.local` or set Vercel project env vars."
    );
  }

  return { uri, dbName };
}

/**
 * Best-effort Vercel pool attachment.
 * Safe no-op when `@vercel/functions` is unavailable locally.
 */
async function maybeAttachDatabasePool(client: MongoClient) {
  if (globalForMongo.__mongoPoolAttached) return;

  try {
    const mod = (await import("@vercel/functions")) as {
      attachDatabasePool?: (pool: unknown) => void;
    };
    if (typeof mod.attachDatabasePool === "function") {
      mod.attachDatabasePool(client);
      globalForMongo.__mongoPoolAttached = true;
    }
  } catch {
    // Optional runtime integration; ignore if package/module is unavailable.
  }
}

/**
 * Returns a singleton MongoClient promise.
 * Uses conservative pool settings that work well in serverless environments.
 */
export function getMongoClient(): Promise<MongoClient> {
  const { uri } = getMongoEnv();

  if (!globalForMongo.__mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
    });

    globalForMongo.__mongoClientPromise = client.connect().then(async (connected) => {
      await maybeAttachDatabasePool(connected);
      return connected;
    });
  }

  return globalForMongo.__mongoClientPromise;
}

/**
 * Returns a DB handle.
 * Uses MONGODB_DB when set, otherwise falls back to DB inferred from URI.
 */
export async function getMongoDb(): Promise<Db> {
  const { dbName } = getMongoEnv();
  const client = await getMongoClient();
  return dbName ? client.db(dbName) : client.db();
}

import { MongoClient, Db } from "mongodb";

/**
 * Cache Mongo client across hot reloads / warm serverless invocations.
 * This is the standard production-safe pattern to avoid connection storms.
 */
const globalForMongo = globalThis as typeof globalThis & {
  __mongoClientPromise?: Promise<MongoClient>;
};

function getMongoEnv() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Set it in local env and in Vercel project environment variables."
    );
  }

  return { uri, dbName };
}

/**
 * Returns a singleton MongoClient connection promise.
 */
export function getMongoClient(): Promise<MongoClient> {
  const { uri } = getMongoEnv();

  if (!globalForMongo.__mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
    });
    globalForMongo.__mongoClientPromise = client.connect();
  }

  return globalForMongo.__mongoClientPromise;
}

/**
 * Returns a DB handle. Uses MONGODB_DB when provided,
 * otherwise falls back to the default DB inferred from the URI.
 */
export async function getMongoDb(): Promise<Db> {
  const { dbName } = getMongoEnv();
  const client = await getMongoClient();
  return dbName ? client.db(dbName) : client.db();
}

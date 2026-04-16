import type { Collection, Db, ObjectId } from "mongodb";
import { z } from "zod";
import { ensureIndexesOnce } from "./_shared";

export const userPlayerSchema = z.object({
  userId: z.string().min(1),
  playerId: z.string().min(1),
  level: z.number().int().min(1).default(1),
  xp: z.number().int().min(0).default(0),
  evolutionStage: z.number().int().min(0).max(3).default(0),
  stats: z.object({
    confidence: z.number().int().min(0).max(99),
    form: z.number().int().min(0).max(99),
    morale: z.number().int().min(0).max(99),
    fanBond: z.number().int().min(0).max(99),
  }),
  shards: z.number().int().min(0).default(0),
  recruitedAt: z.date(),
  lastTrainedAt: z.date().nullable().default(null),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserPlayerDoc = z.infer<typeof userPlayerSchema> & { _id?: ObjectId };

export function buildUserPlayerInsert(
  data: Omit<UserPlayerDoc, "_id" | "createdAt" | "updatedAt">
) {
  const now = new Date();
  return userPlayerSchema.parse({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export function buildUserPlayerUpdate(
  data: Partial<Omit<UserPlayerDoc, "_id" | "createdAt" | "recruitedAt">>
) {
  return {
    ...data,
    updatedAt: new Date(),
  };
}

export async function ensureUserPlayerIndexes(db: Db) {
  await ensureIndexesOnce(db, "user-player-indexes-v1", async (targetDb) => {
    const c = targetDb.collection<UserPlayerDoc>("user_players");
    await c.createIndex({ userId: 1, playerId: 1 }, { unique: true });
    await c.createIndex({ userId: 1, updatedAt: -1 });
    await c.createIndex({ userId: 1, level: -1 });
    await c.createIndex({ playerId: 1 });
  });
}

export async function getUserPlayerCollection(db: Db): Promise<Collection<UserPlayerDoc>> {
  await ensureUserPlayerIndexes(db);
  return db.collection<UserPlayerDoc>("user_players");
}

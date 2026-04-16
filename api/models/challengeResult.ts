import type { Collection, Db, ObjectId } from "mongodb";
import { z } from "zod";
import { ensureIndexesOnce } from "./_shared";

export const challengeResultSchema = z.object({
  userId: z.string().min(1),
  playerId: z.string().min(1),
  opponentUserId: z.string().optional(),
  opponentPower: z.number().int().min(0),
  result: z.enum(["win", "loss", "draw"]),
  scoreDelta: z.number().int(),
  rewards: z.object({
    xp: z.number().int().min(0).default(0),
    shards: z.number().int().min(0).default(0),
  }),
  region: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ChallengeResultDoc = z.infer<typeof challengeResultSchema> & {
  _id?: ObjectId;
};

export function buildChallengeResultInsert(
  data: Omit<ChallengeResultDoc, "_id" | "createdAt" | "updatedAt">
) {
  const now = new Date();
  return challengeResultSchema.parse({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export async function ensureChallengeResultIndexes(db: Db) {
  await ensureIndexesOnce(db, "challenge-result-indexes-v1", async (targetDb) => {
    const c = targetDb.collection<ChallengeResultDoc>("challenge_results");
    await c.createIndex({ userId: 1, createdAt: -1 });
    await c.createIndex({ region: 1, createdAt: -1 });
    await c.createIndex({ playerId: 1, createdAt: -1 });
  });
}

export async function getChallengeResultCollection(
  db: Db
): Promise<Collection<ChallengeResultDoc>> {
  await ensureChallengeResultIndexes(db);
  return db.collection<ChallengeResultDoc>("challenge_results");
}

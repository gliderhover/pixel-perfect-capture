import type { Collection, Db, ObjectId } from "mongodb";
import { z } from "zod";
import { ensureIndexesOnce } from "./_shared";

export const leaderboardEntrySchema = z.object({
  username: z.string().min(1),
  region: z.string().min(1),
  activePlayerId: z.string().min(1),
  score: z.number().int().min(0),
  streak: z.number().int().min(0),
  rankBadge: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type LeaderboardEntryDoc = z.infer<typeof leaderboardEntrySchema> & {
  _id?: ObjectId;
};

export function buildLeaderboardEntryInsert(
  data: Omit<LeaderboardEntryDoc, "createdAt" | "updatedAt" | "_id">
) {
  const now = new Date();
  return leaderboardEntrySchema.parse({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export function buildLeaderboardEntryUpdate(
  data: Partial<Omit<LeaderboardEntryDoc, "_id" | "createdAt">>
) {
  return {
    ...data,
    updatedAt: new Date(),
  };
}

export async function ensureLeaderboardIndexes(db: Db) {
  await ensureIndexesOnce(db, "leaderboard-indexes-v1", async (targetDb) => {
    const c = targetDb.collection<LeaderboardEntryDoc>("leaderboard_entries");
    await c.createIndex({ username: 1, region: 1 });
    await c.createIndex({ region: 1, score: -1 });
    await c.createIndex({ score: -1, streak: -1 });
    await c.createIndex({ updatedAt: -1 });
  });
}

export async function getLeaderboardCollection(
  db: Db
): Promise<Collection<LeaderboardEntryDoc>> {
  await ensureLeaderboardIndexes(db);
  return db.collection<LeaderboardEntryDoc>("leaderboard_entries");
}

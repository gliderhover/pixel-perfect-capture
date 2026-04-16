import type { Collection, Db, ObjectId } from "mongodb";
import { z } from "zod";
import { ensureIndexesOnce } from "./_shared";

export const playerRaritySchema = z.enum(["common", "rare", "epic", "legendary"]);

export const playerSchema = z.object({
  /**
   * Stable external id from the frontend mock dataset.
   * Used for idempotent upserts in seed routines.
   */
  externalId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  portrait: z.string().min(1),
  age: z.number().int().min(10).max(60),
  position: z.string().min(1),
  clubTeam: z.string().min(1),
  nationalTeam: z.string().min(1),
  representedCountry: z.string().min(1),
  rarity: playerRaritySchema,
  traits: z.array(z.string().min(1)).default([]),
  stats: z.object({
    confidence: z.number().int().min(0).max(99),
    form: z.number().int().min(0).max(99),
    morale: z.number().int().min(0).max(99),
    fanBond: z.number().int().min(0).max(99),
  }),
  level: z.number().int().min(1).default(1),
  xp: z.number().int().min(0).default(0),
  evolutionStage: z.number().int().min(0).max(3).default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PlayerDoc = z.infer<typeof playerSchema> & { _id?: ObjectId };

export function buildPlayerInsert(data: Omit<PlayerDoc, "createdAt" | "updatedAt" | "_id">) {
  const now = new Date();
  return playerSchema.parse({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export function buildPlayerUpdate(data: Partial<Omit<PlayerDoc, "_id" | "createdAt">>) {
  return {
    ...data,
    updatedAt: new Date(),
  };
}

export async function ensurePlayerIndexes(db: Db) {
  await ensureIndexesOnce(db, "player-indexes-v1", async (targetDb) => {
    const c = targetDb.collection<PlayerDoc>("players");
    await c.createIndex({ externalId: 1 }, { unique: true });
    await c.createIndex({ slug: 1 }, { unique: true });
    await c.createIndex({ rarity: 1, level: -1 });
    await c.createIndex({ representedCountry: 1, position: 1 });
    await c.createIndex({ updatedAt: -1 });
  });
}

export async function getPlayerCollection(db: Db): Promise<Collection<PlayerDoc>> {
  await ensurePlayerIndexes(db);
  return db.collection<PlayerDoc>("players");
}

import type { Collection, Db, ObjectId } from "mongodb";
import { z } from "zod";
import { ensureIndexesOnce } from "./_shared";

export const zoneSchema = z.object({
  zoneType: z.enum([
    "training",
    "recovery",
    "fan-arena",
    "rival",
    "pressure",
    "stadium",
    "mission",
  ]),
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  region: z.string().min(1),
  rewardType: z.string().min(1),
  active: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ZoneDoc = z.infer<typeof zoneSchema> & { _id?: ObjectId };

export function buildZoneInsert(data: Omit<ZoneDoc, "createdAt" | "updatedAt" | "_id">) {
  const now = new Date();
  return zoneSchema.parse({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export function buildZoneUpdate(data: Partial<Omit<ZoneDoc, "_id" | "createdAt">>) {
  return {
    ...data,
    updatedAt: new Date(),
  };
}

export async function ensureZoneIndexes(db: Db) {
  await ensureIndexesOnce(db, "zone-indexes-v1", async (targetDb) => {
    const c = targetDb.collection<ZoneDoc>("zones");
    await c.createIndex({ zoneType: 1, active: 1 });
    await c.createIndex({ region: 1, active: 1 });
    await c.createIndex({ latitude: 1, longitude: 1 });
    await c.createIndex({ updatedAt: -1 });
  });
}

export async function getZoneCollection(db: Db): Promise<Collection<ZoneDoc>> {
  await ensureZoneIndexes(db);
  return db.collection<ZoneDoc>("zones");
}

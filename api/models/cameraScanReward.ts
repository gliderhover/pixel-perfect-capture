import type { Collection, Db, ObjectId } from "mongodb";
import { z } from "zod";
import { ensureIndexesOnce } from "./_shared";

export const cameraScanRewardSchema = z.object({
  userId: z.string().min(1),
  playerId: z.string().min(1),
  zoneType: z
    .enum(["training", "recovery", "fan-arena", "rival", "pressure", "stadium", "mission"])
    .optional(),
  missionId: z.string().optional(),
  reward: z.object({
    xp: z.number().int().min(0),
    shards: z.number().int().min(0),
    statBoost: z
      .object({
        confidence: z.number().int().min(-10).max(10).optional(),
        form: z.number().int().min(-10).max(10).optional(),
        morale: z.number().int().min(-10).max(10).optional(),
        fanBond: z.number().int().min(-10).max(10).optional(),
      })
      .optional(),
  }),
  scanContext: z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    clientTag: z.string().optional(),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CameraScanRewardDoc = z.infer<typeof cameraScanRewardSchema> & {
  _id?: ObjectId;
};

export function buildCameraScanRewardInsert(
  data: Omit<CameraScanRewardDoc, "_id" | "createdAt" | "updatedAt">
) {
  const now = new Date();
  return cameraScanRewardSchema.parse({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export async function ensureCameraScanIndexes(db: Db) {
  await ensureIndexesOnce(db, "camera-scan-indexes-v1", async (targetDb) => {
    const c = targetDb.collection<CameraScanRewardDoc>("camera_scan_rewards");
    await c.createIndex({ userId: 1, createdAt: -1 });
    await c.createIndex({ playerId: 1, createdAt: -1 });
    await c.createIndex({ missionId: 1 }, { sparse: true });
  });
}

export async function getCameraScanRewardCollection(
  db: Db
): Promise<Collection<CameraScanRewardDoc>> {
  await ensureCameraScanIndexes(db);
  return db.collection<CameraScanRewardDoc>("camera_scan_rewards");
}

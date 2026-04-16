import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../../lib/mongodb";
import { getCameraScanRewardCollection, getUserPlayerCollection } from "../../lib/server/dbCollections";
import { clampStat, nextXpThreshold } from "../../lib/server/progression";

const bodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
  zoneType: z
    .enum(["training", "recovery", "fan-arena", "rival", "pressure", "stadium", "mission"])
    .optional(),
  missionId: z.string().optional(),
});

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

/**
 * POST /api/camera-scans/reward
 * Persists camera mission reward and applies progression updates.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

  try {
    const { userId, playerId, zoneType, missionId } = parsed.data;
    const db = await getMongoDb();
    const userPlayers = await getUserPlayerCollection(db);
    const rewards = await getCameraScanRewardCollection(db);

    const doc = await userPlayers.findOne({ userId, playerId });
    if (!doc) {
      return res.status(404).json({ error: "User player not found. Recruit first." });
    }

    const xpGain = 6;
    const shardGain = zoneType === "mission" ? 2 : 1;
    const statBoost = {
      confidence: zoneType === "rival" ? 2 : 1,
      form: zoneType === "training" ? 2 : 1,
      morale: zoneType === "recovery" ? 2 : 1,
      fanBond: zoneType === "fan-arena" ? 2 : 1,
    };

    let xp = doc.xp + xpGain;
    let level = doc.level;
    while (level < 99 && xp >= nextXpThreshold(level)) {
      xp -= nextXpThreshold(level);
      level += 1;
    }

    const updatedStats = {
      confidence: clampStat(doc.stats.confidence + statBoost.confidence),
      form: clampStat(doc.stats.form + statBoost.form),
      morale: clampStat(doc.stats.morale + statBoost.morale),
      fanBond: clampStat(doc.stats.fanBond + statBoost.fanBond),
    };

    const now = new Date();
    const evolutionStage = Math.min(3, Math.floor(level / 5));

    await userPlayers.updateOne(
      { userId, playerId },
      {
        $set: {
          level,
          xp,
          evolutionStage,
          stats: updatedStats,
          shards: doc.shards + shardGain,
          updatedAt: now,
        },
      }
    );

    const rewardDoc = {
      userId,
      playerId,
      zoneType,
      missionId,
      reward: {
        xp: xpGain,
        shards: shardGain,
        statBoost,
      },
      scanContext: {},
      createdAt: now,
      updatedAt: now,
    };
    await rewards.insertOne(rewardDoc);

    const updated = await userPlayers.findOne({ userId, playerId });
    return res.status(200).json({
      ok: true,
      reward: cleanDoc(rewardDoc),
      userPlayer: updated ? cleanDoc(updated) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown camera reward error";
    return res.status(500).json({ error: message });
  }
}

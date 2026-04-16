import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../../lib/mongodb";
import { getChallengeResultCollection, getUserPlayerCollection } from "../../lib/server/dbCollections";
import { clampStat, nextXpThreshold } from "../../lib/server/progression";

const bodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
  result: z.enum(["win", "loss", "draw"]),
  opponentPower: z.number().int().min(0).default(2500),
  region: z.string().min(1).default("CONCACAF · NA"),
  opponentUserId: z.string().optional(),
});

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

/**
 * POST /api/challenges/result
 * Persists challenge result and updates user player progression.
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
    const { userId, playerId, result, opponentPower, region, opponentUserId } = parsed.data;
    const db = await getMongoDb();
    const userPlayers = await getUserPlayerCollection(db);
    const challengeResults = await getChallengeResultCollection(db);

    const userPlayer = await userPlayers.findOne({ userId, playerId });
    if (!userPlayer) {
      return res.status(404).json({ error: "User player not found. Recruit first." });
    }

    const rewardByResult = {
      win: { xp: 20, shards: 2, scoreDelta: 32, moraleDelta: 2, confidenceDelta: 2 },
      draw: { xp: 10, shards: 1, scoreDelta: 12, moraleDelta: 1, confidenceDelta: 1 },
      loss: { xp: 6, shards: 0, scoreDelta: -8, moraleDelta: -1, confidenceDelta: 0 },
    } as const;
    const reward = rewardByResult[result];

    let xp = userPlayer.xp + reward.xp;
    let level = userPlayer.level;
    while (level < 99 && xp >= nextXpThreshold(level)) {
      xp -= nextXpThreshold(level);
      level += 1;
    }
    const evolutionStage = Math.min(3, Math.floor(level / 5));

    const now = new Date();
    await userPlayers.updateOne(
      { userId, playerId },
      {
        $set: {
          level,
          xp,
          evolutionStage,
          shards: userPlayer.shards + reward.shards,
          stats: {
            confidence: clampStat(userPlayer.stats.confidence + reward.confidenceDelta),
            form: clampStat(userPlayer.stats.form + (result === "win" ? 1 : 0)),
            morale: clampStat(userPlayer.stats.morale + reward.moraleDelta),
            fanBond: clampStat(userPlayer.stats.fanBond + (result === "win" ? 1 : 0)),
          },
          updatedAt: now,
        },
      }
    );

    const challengeDoc = {
      userId,
      playerId,
      opponentUserId,
      opponentPower,
      result,
      scoreDelta: reward.scoreDelta,
      rewards: {
        xp: reward.xp,
        shards: reward.shards,
      },
      region,
      createdAt: now,
      updatedAt: now,
    };
    await challengeResults.insertOne(challengeDoc);

    const updated = await userPlayers.findOne({ userId, playerId });
    return res.status(200).json({
      ok: true,
      challenge: cleanDoc(challengeDoc),
      userPlayer: updated ? cleanDoc(updated) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown challenge result error";
    return res.status(500).json({ error: message });
  }
}

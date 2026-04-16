import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../../lib/mongodb";
import { getUserPlayerCollection } from "../../lib/server/dbCollections";

const bodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
  attributeDeltas: z.object({
    confidence: z.number().int().min(-8).max(8).default(0),
    form: z.number().int().min(-8).max(8).default(0),
    morale: z.number().int().min(-8).max(8).default(0),
    fanBond: z.number().int().min(-8).max(8).default(0),
  }),
  xpGain: z.number().int().min(0).max(50).default(5),
});

function clampStat(v: number) {
  return Math.max(0, Math.min(99, v));
}

function nextXpThreshold(level: number) {
  return 80 + level * 40;
}

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

/**
 * POST /api/cultivation/apply
 * Persists chat/cultivation deltas to user-owned player progression.
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
    const { userId, playerId, attributeDeltas, xpGain } = parsed.data;
    const db = await getMongoDb();
    const userPlayers = await getUserPlayerCollection(db);
    const current = await userPlayers.findOne({ userId, playerId });

    if (!current) {
      return res.status(404).json({ error: "User player not found. Recruit first." });
    }

    let xp = current.xp + xpGain;
    let level = current.level;
    while (level < 99 && xp >= nextXpThreshold(level)) {
      xp -= nextXpThreshold(level);
      level += 1;
    }
    const evolutionStage = Math.min(3, Math.floor(level / 5));

    const stats = {
      confidence: clampStat(current.stats.confidence + attributeDeltas.confidence),
      form: clampStat(current.stats.form + attributeDeltas.form),
      morale: clampStat(current.stats.morale + attributeDeltas.morale),
      fanBond: clampStat(current.stats.fanBond + attributeDeltas.fanBond),
    };

    const now = new Date();
    await userPlayers.updateOne(
      { userId, playerId },
      {
        $set: {
          level,
          xp,
          evolutionStage,
          stats,
          updatedAt: now,
        },
      }
    );

    const updated = await userPlayers.findOne({ userId, playerId });
    return res.status(200).json({
      ok: true,
      xpGained: xpGain,
      attributeDeltas,
      data: updated ? cleanDoc(updated) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown cultivation apply error";
    return res.status(500).json({ error: message });
  }
}

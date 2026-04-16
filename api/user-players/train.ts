import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../lib/mongodb";
import { getUserPlayerCollection } from "../models/userPlayer";

const bodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
  mode: z.enum(["balanced", "confidence", "form", "morale", "bond"]).default("balanced"),
});

type StatDelta = {
  confidence?: number;
  form?: number;
  morale?: number;
  fanBond?: number;
};

const modeMap: Record<string, { xp: number; delta: StatDelta }> = {
  balanced: { xp: 8, delta: { confidence: 1, form: 1, morale: 1, fanBond: 1 } },
  confidence: { xp: 10, delta: { confidence: 2, morale: 1 } },
  form: { xp: 10, delta: { form: 2, confidence: 1 } },
  morale: { xp: 10, delta: { morale: 2, fanBond: 1 } },
  bond: { xp: 9, delta: { fanBond: 2, morale: 1 } },
};

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

function nextXpThreshold(level: number) {
  return 80 + level * 40;
}

function clampStat(value: number) {
  return Math.max(0, Math.min(99, value));
}

/**
 * POST /api/user-players/train
 * Body: { userId: "demo-user", playerId: "<externalId>", mode?: "balanced" | ... }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const parsed = bodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const { userId, playerId, mode } = parsed.data;
    const db = await getMongoDb();
    const userPlayers = await getUserPlayerCollection(db);
    const doc = await userPlayers.findOne({ userId, playerId });

    if (!doc) {
      return res.status(404).json({ error: "User player not found. Recruit first." });
    }

    const plan = modeMap[mode] ?? modeMap.balanced;
    let xp = doc.xp + plan.xp;
    let level = doc.level;
    while (level < 99 && xp >= nextXpThreshold(level)) {
      xp -= nextXpThreshold(level);
      level += 1;
    }

    const stats = {
      confidence: clampStat(doc.stats.confidence + (plan.delta.confidence ?? 0)),
      form: clampStat(doc.stats.form + (plan.delta.form ?? 0)),
      morale: clampStat(doc.stats.morale + (plan.delta.morale ?? 0)),
      fanBond: clampStat(doc.stats.fanBond + (plan.delta.fanBond ?? 0)),
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
          stats,
          lastTrainedAt: now,
          updatedAt: now,
        },
      }
    );

    const updated = await userPlayers.findOne({ userId, playerId });
    return res.status(200).json({
      ok: true,
      mode,
      delta: plan.delta,
      xpGained: plan.xp,
      data: updated ? cleanDoc(updated) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown train error";
    return res.status(500).json({ error: message });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../../lib/mongodb";
import { getLeaderboardCollection, getUserPlayerCollection } from "../../lib/server/dbCollections";

const bodySchema = z.object({
  userId: z.string().min(1).optional(),
  scope: z.enum(["global", "region"]).default("global"),
  region: z.string().optional(),
});

type PlayerStats = {
  confidence: number;
  form: number;
  morale: number;
  fanBond: number;
};

function computeScore(level: number, xp: number, evolutionStage: number, stats: PlayerStats) {
  const statSum = stats.confidence + stats.form + stats.morale + stats.fanBond;
  return Math.round(level * 120 + xp * 0.6 + evolutionStage * 400 + statSum * 8);
}

/**
 * POST /api/leaderboard/recalculate
 * Rebuilds leaderboard rows from user player progression state.
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
    const { userId, scope, region } = parsed.data;
    const db = await getMongoDb();
    const userPlayers = await getUserPlayerCollection(db);
    const leaderboard = await getLeaderboardCollection(db);

    const playerFilter: Record<string, unknown> = {};
    if (userId) playerFilter.userId = userId;
    const docs = await userPlayers.find(playerFilter).toArray();
    if (docs.length === 0) {
      return res.status(200).json({ ok: true, updated: 0, message: "No user players to recalculate" });
    }

    const grouped = new Map<string, typeof docs>();
    for (const d of docs) {
      const rows = grouped.get(d.userId) ?? [];
      rows.push(d);
      grouped.set(d.userId, rows);
    }

    let updatedCount = 0;
    const now = new Date();
    for (const [uid, rows] of grouped) {
      const active = [...rows].sort((a, b) => {
        const aScore = computeScore(a.level, a.xp, a.evolutionStage, a.stats);
        const bScore = computeScore(b.level, b.xp, b.evolutionStage, b.stats);
        return bScore - aScore;
      })[0];

      const score = rows.reduce(
        (sum, r) => sum + computeScore(r.level, r.xp, r.evolutionStage, r.stats),
        0
      );

      const entryRegion = scope === "region" ? region ?? "CONCACAF · NA" : "GLOBAL";
      await leaderboard.updateOne(
        { username: uid, region: entryRegion },
        {
          $set: {
            activePlayerId: active.playerId,
            score,
            streak: Math.max(1, Math.floor(active.level / 3)),
            updatedAt: now,
          },
          $setOnInsert: {
            username: uid,
            region: entryRegion,
            createdAt: now,
            rankBadge: undefined,
          },
        },
        { upsert: true }
      );
      updatedCount += 1;
    }

    return res.status(200).json({
      ok: true,
      updated: updatedCount,
      scope,
      region: scope === "region" ? region ?? "CONCACAF · NA" : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown leaderboard recalc error";
    return res.status(500).json({ error: message });
  }
}

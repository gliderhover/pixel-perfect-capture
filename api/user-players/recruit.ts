import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../../lib/mongodb";
import { getPlayerCollection, getUserPlayerCollection } from "../../lib/server/dbCollections";

const bodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
});

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

function buildUserPlayerInsert(input: {
  userId: string;
  playerId: string;
  level: number;
  xp: number;
  evolutionStage: number;
  stats: { confidence: number; form: number; morale: number; fanBond: number };
  shards: number;
  recruitedAt: Date;
  lastTrainedAt: Date | null;
}) {
  const now = new Date();
  return {
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * POST /api/user-players/recruit
 * Body: { userId: "demo-user", playerId: "<externalId-or-slug>" }
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

    const { userId, playerId } = parsed.data;
    const db = await getMongoDb();
    const players = await getPlayerCollection(db);
    const userPlayers = await getUserPlayerCollection(db);

    const basePlayer =
      (await players.findOne({ externalId: playerId })) ??
      (await players.findOne({ slug: playerId }));

    if (!basePlayer) {
      return res.status(404).json({ error: "Base player not found" });
    }

    const existing = await userPlayers.findOne({ userId, playerId: basePlayer.externalId });
    if (existing) {
      return res.status(200).json({
        ok: true,
        recruited: false,
        message: "Player already recruited",
        data: cleanDoc(existing),
      });
    }

    // Recruits always start weak, aligned with app design.
    const weakStats = {
      confidence: Math.max(20, Math.min(35, basePlayer.stats.confidence)),
      form: Math.max(20, Math.min(35, basePlayer.stats.form)),
      morale: Math.max(20, Math.min(35, basePlayer.stats.morale)),
      fanBond: Math.max(20, Math.min(35, basePlayer.stats.fanBond)),
    };

    const insert = buildUserPlayerInsert({
      userId,
      playerId: basePlayer.externalId,
      level: 1,
      xp: 0,
      evolutionStage: 0,
      stats: weakStats,
      shards: 0,
      recruitedAt: new Date(),
      lastTrainedAt: null,
    });

    await userPlayers.insertOne(insert);

    return res.status(201).json({
      ok: true,
      recruited: true,
      data: cleanDoc(insert),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown recruit error";
    return res.status(500).json({ error: message });
  }
}

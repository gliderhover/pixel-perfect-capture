import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../lib/mongodb";
import {
  getCameraScanRewardCollection,
  getChallengeResultCollection,
  getLeaderboardCollection,
  getUserPlayerCollection,
} from "../lib/server/dbCollections";
import { clampStat, nextXpThreshold } from "../lib/server/progression";

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

function getRouteParts(req: VercelRequest) {
  const route = req.query.route;
  if (!route) return [];
  return Array.isArray(route) ? route : [route];
}

const cameraRewardBodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
  zoneType: z
    .enum(["training", "recovery", "fan-arena", "rival", "pressure", "stadium", "mission"])
    .optional(),
  missionId: z.string().optional(),
});

const challengeResultBodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
  result: z.enum(["win", "loss", "draw"]),
  opponentPower: z.number().int().min(0).default(2500),
  region: z.string().min(1).default("CONCACAF · NA"),
  opponentUserId: z.string().optional(),
});

const leaderboardRecalcBodySchema = z.object({
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

async function handleHealth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const db = await getMongoDb();
  await db.command({ ping: 1 });
  return res.status(200).json({ ok: true, db: db.databaseName });
}

async function handleCameraReward(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = cameraRewardBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

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
}

async function handleChallengeResult(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = challengeResultBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

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
}

async function handleLeaderboardRecalculate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = leaderboardRecalcBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const parts = getRouteParts(req);
    const path = parts.join("/");

    if (path === "health") return await handleHealth(req, res);
    if (path === "camera-scans/reward") return await handleCameraReward(req, res);
    if (path === "challenges/result") return await handleChallengeResult(req, res);
    if (path === "leaderboard/recalculate") return await handleLeaderboardRecalculate(req, res);

    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown merged route error";
    return res.status(500).json({ error: message });
  }
}

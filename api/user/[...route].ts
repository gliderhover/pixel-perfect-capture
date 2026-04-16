import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../../lib/mongodb";
import { getCameraScanRewardCollection, getChallengeResultCollection, getPlayerCollection, getUserPlayerCollection } from "../../lib/server/dbCollections";
import { clampStat, nextXpThreshold } from "../../lib/server/progression";

const userPlayersQuerySchema = z.object({
  userId: z.string().min(1),
});

const recruitBodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
});

const trainBodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
  mode: z.enum(["balanced", "confidence", "form", "morale", "bond"]).default("balanced"),
});

const challengeResultBodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
  result: z.enum(["win", "loss", "draw"]),
  opponentPower: z.number().int().min(0).default(2500),
  region: z.string().min(1).default("CONCACAF · NA"),
  opponentUserId: z.string().optional(),
});

const cameraRewardBodySchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  playerId: z.string().min(1),
  zoneType: z
    .enum(["training", "recovery", "fan-arena", "rival", "pressure", "stadium", "mission"])
    .optional(),
  missionId: z.string().optional(),
});

const cultivationApplyBodySchema = z.object({
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

function getRouteParts(req: VercelRequest) {
  const dynamicQuery = req.query as Record<string, string | string[] | undefined>;
  const route = dynamicQuery.route ?? dynamicQuery["...route"];
  if (route) {
    return Array.isArray(route) ? route : [route];
  }
  const pathname = (req.url ?? "").split("?")[0] ?? "";
  const parts = pathname.split("/").filter(Boolean);
  const apiIdx = parts.indexOf("api");
  if (apiIdx >= 0 && parts[apiIdx + 1] === "user") {
    return parts.slice(apiIdx + 2);
  }
  return [];
}

function toArrayValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

async function handleListUserPlayers(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = userPlayersQuerySchema.safeParse({ userId: toArrayValue(req.query.userId) });
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten(),
    });
  }

  const db = await getMongoDb();
  const userPlayers = await getUserPlayerCollection(db);
  const docs = await userPlayers
    .find({ userId: parsed.data.userId })
    .sort({ updatedAt: -1 })
    .toArray();

  return res.status(200).json({
    data: docs.map(cleanDoc),
    count: docs.length,
    userId: parsed.data.userId,
  });
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

async function handleRecruit(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = recruitBodySchema.safeParse(req.body ?? {});
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
}

async function handleTrain(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = trainBodySchema.safeParse(req.body ?? {});
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

function clampLocalStat(v: number) {
  return Math.max(0, Math.min(99, v));
}

function nextLocalXpThreshold(level: number) {
  return 80 + level * 40;
}

async function handleCultivationApply(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = cultivationApplyBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

  const { userId, playerId, attributeDeltas, xpGain } = parsed.data;
  const db = await getMongoDb();
  const userPlayers = await getUserPlayerCollection(db);
  const current = await userPlayers.findOne({ userId, playerId });
  if (!current) {
    return res.status(404).json({ error: "User player not found. Recruit first." });
  }

  let xp = current.xp + xpGain;
  let level = current.level;
  while (level < 99 && xp >= nextLocalXpThreshold(level)) {
    xp -= nextLocalXpThreshold(level);
    level += 1;
  }
  const evolutionStage = Math.min(3, Math.floor(level / 5));
  const stats = {
    confidence: clampLocalStat(current.stats.confidence + attributeDeltas.confidence),
    form: clampLocalStat(current.stats.form + attributeDeltas.form),
    morale: clampLocalStat(current.stats.morale + attributeDeltas.morale),
    fanBond: clampLocalStat(current.stats.fanBond + attributeDeltas.fanBond),
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
}

/**
 * Grouped user/progression router.
 * Supports:
 * - GET /api/user/user-players
 * - POST /api/user/user-players/recruit
 * - POST /api/user/user-players/train
 * - POST /api/user/challenges/result
 * - POST /api/user/camera-scans/reward
 * - POST /api/user/cultivation/apply
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const parts = getRouteParts(req);
    const path = parts.join("/");

    if (path === "user-players") return await handleListUserPlayers(req, res);
    if (path === "user-players/recruit" || path === "user-players-recruit") {
      return await handleRecruit(req, res);
    }
    if (path === "user-players/train" || path === "user-players-train") {
      return await handleTrain(req, res);
    }
    if (path === "challenges/result" || path === "challenges-result") {
      return await handleChallengeResult(req, res);
    }
    if (path === "camera-scans/reward" || path === "camera-scans-reward") {
      return await handleCameraReward(req, res);
    }
    if (path === "cultivation/apply" || path === "cultivation-apply") {
      return await handleCultivationApply(req, res);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown user router error";
    return res.status(500).json({ error: message });
  }
}

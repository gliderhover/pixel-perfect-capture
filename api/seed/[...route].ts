import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../../lib/mongodb";
import {
  getLeaderboardCollection,
  getPlayerCollection,
  getUserPlayerCollection,
  getZoneCollection,
  type LeaderboardEntryDoc,
  type PlayerDoc,
  type UserPlayerDoc,
  type ZoneDoc,
} from "../../lib/server/dbCollections";
import { mockPlayers, mockZones } from "../../src/data/mockData";
import { mockLeaderboardGlobal, mockLeaderboardRegion } from "../../src/data/leaderboardData";

const bootstrapBodySchema = z.object({
  seedUserPlayers: z.boolean().default(true),
  userId: z.string().min(1).default("demo-user"),
});

function getRouteParts(req: VercelRequest) {
  const dynamicQuery = req.query as Record<string, string | string[] | undefined>;
  const route = dynamicQuery.route ?? dynamicQuery["...route"];
  if (route) {
    return Array.isArray(route) ? route : [route];
  }
  const pathname = (req.url ?? "").split("?")[0] ?? "";
  const parts = pathname.split("/").filter(Boolean);
  const apiIdx = parts.indexOf("api");
  if (apiIdx >= 0 && parts[apiIdx + 1] === "seed") {
    return parts.slice(apiIdx + 2);
  }
  return [];
}

function toSlug(id: string, name: string) {
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `player-${id}-${safeName}`;
}

async function handleSeedPlayers(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = await getMongoDb();
  const players = await getPlayerCollection(db);
  const now = new Date();

  let upserted = 0;
  let updated = 0;
  for (const p of mockPlayers) {
    const doc: Omit<PlayerDoc, "_id"> = {
      externalId: p.id,
      slug: toSlug(p.id, p.name),
      name: p.name,
      portrait: p.portrait,
      age: p.age,
      position: p.position,
      clubTeam: p.clubTeam,
      nationalTeam: p.nationalTeam,
      representedCountry: p.representedCountry,
      rarity: p.rarity,
      traits: p.traits,
      stats: {
        confidence: p.attributes.confidence,
        form: p.attributes.form,
        morale: p.attributes.morale,
        fanBond: p.attributes.fanBond,
      },
      level: p.level,
      xp: p.currentXp,
      evolutionStage: p.evolutionStage,
      createdAt: now,
      updatedAt: now,
    };

    const result = await players.updateOne(
      { externalId: p.id },
      {
        $set: {
          slug: doc.slug,
          name: doc.name,
          portrait: doc.portrait,
          age: doc.age,
          position: doc.position,
          clubTeam: doc.clubTeam,
          nationalTeam: doc.nationalTeam,
          representedCountry: doc.representedCountry,
          rarity: doc.rarity,
          traits: doc.traits,
          stats: doc.stats,
          level: doc.level,
          xp: doc.xp,
          evolutionStage: doc.evolutionStage,
          updatedAt: now,
        },
        $setOnInsert: {
          externalId: doc.externalId,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) upserted += 1;
    else if (result.matchedCount > 0) updated += 1;
  }

  return res.status(200).json({
    ok: true,
    totalSource: mockPlayers.length,
    upserted,
    updated,
  });
}

async function handleSeedBootstrap(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = bootstrapBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

  const { seedUserPlayers, userId } = parsed.data;
  const db = await getMongoDb();
  const zones = await getZoneCollection(db);
  const leaderboard = await getLeaderboardCollection(db);
  const userPlayers = await getUserPlayerCollection(db);
  const players = await getPlayerCollection(db);

  const now = new Date();

  let seededZones = 0;
  let updatedZones = 0;
  for (const zone of mockZones) {
    const doc: Omit<ZoneDoc, "_id"> = {
      zoneType: zone.type,
      name: zone.name,
      latitude: zone.lat,
      longitude: zone.lng,
      region: "CONCACAF · NA",
      rewardType: zone.benefit,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    const result = await zones.updateOne(
      { name: doc.name },
      {
        $set: {
          zoneType: doc.zoneType,
          latitude: doc.latitude,
          longitude: doc.longitude,
          region: doc.region,
          rewardType: doc.rewardType,
          active: doc.active,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) seededZones += 1;
    else if (result.matchedCount > 0) updatedZones += 1;
  }

  const leaderboardRows = [...mockLeaderboardGlobal, ...mockLeaderboardRegion];
  const uniq = new Map<string, LeaderboardEntryDoc>();
  for (const row of leaderboardRows) {
    const key = `${row.userName}::${row.region}`;
    uniq.set(key, {
      username: row.userName,
      region: row.region,
      activePlayerId: row.playerId,
      score: row.teamPower,
      streak: row.streak,
      rankBadge: row.rank <= 3 ? `top-${row.rank}` : undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  let seededLeaderboard = 0;
  let updatedLeaderboard = 0;
  for (const row of uniq.values()) {
    const result = await leaderboard.updateOne(
      { username: row.username, region: row.region },
      {
        $set: {
          activePlayerId: row.activePlayerId,
          score: row.score,
          streak: row.streak,
          rankBadge: row.rankBadge,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) seededLeaderboard += 1;
    else if (result.matchedCount > 0) updatedLeaderboard += 1;
  }

  let seededUserPlayers = 0;
  let updatedUserPlayers = 0;
  if (seedUserPlayers) {
    const knownPlayers = await players.find({}, { projection: { externalId: 1 } }).toArray();
    const known = new Set(knownPlayers.map((p) => p.externalId));
    const starters = mockPlayers.filter((p) => known.has(p.id)).slice(0, 3);
    for (const starter of starters) {
      const doc: Omit<UserPlayerDoc, "_id"> = {
        userId,
        playerId: starter.id,
        level: 1,
        xp: 0,
        evolutionStage: 0,
        stats: {
          confidence: Math.max(1, Math.min(99, starter.attributes.confidence - 8)),
          form: Math.max(1, Math.min(99, starter.attributes.form - 8)),
          morale: Math.max(1, Math.min(99, starter.attributes.morale - 8)),
          fanBond: Math.max(1, Math.min(99, starter.attributes.fanBond - 8)),
        },
        shards: 0,
        recruitedAt: now,
        lastTrainedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const result = await userPlayers.updateOne(
        { userId: doc.userId, playerId: doc.playerId },
        {
          $set: {
            level: doc.level,
            xp: doc.xp,
            evolutionStage: doc.evolutionStage,
            stats: doc.stats,
            shards: doc.shards,
            lastTrainedAt: doc.lastTrainedAt,
            recruitedAt: doc.recruitedAt,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
      if (result.upsertedCount > 0) seededUserPlayers += 1;
      else if (result.matchedCount > 0) updatedUserPlayers += 1;
    }
  }

  return res.status(200).json({
    ok: true,
    seeded: {
      zones: seededZones,
      leaderboard: seededLeaderboard,
      userPlayers: seededUserPlayers,
    },
    updated: {
      zones: updatedZones,
      leaderboard: updatedLeaderboard,
      userPlayers: updatedUserPlayers,
    },
    options: {
      seedUserPlayers,
      userId,
    },
    sourceCounts: {
      zoneRows: mockZones.length,
      leaderboardRows: uniq.size,
    },
  });
}

/**
 * Grouped seed router.
 * Supports:
 * - POST /api/seed/players
 * - POST /api/seed/bootstrap
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const parts = getRouteParts(req);
    const path = parts.join("/");
    if (path === "players") return await handleSeedPlayers(req, res);
    if (path === "bootstrap") return await handleSeedBootstrap(req, res);
    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown seed router error";
    return res.status(500).json({ error: message });
  }
}

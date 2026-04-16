import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../../lib/mongodb";
import {
  getLeaderboardCollection,
  getPlayerCollection,
  getUserPlayerCollection,
  getZoneCollection,
  type LeaderboardEntryDoc,
  type UserPlayerDoc,
  type ZoneDoc,
} from "../../lib/server/dbCollections";
import { mockPlayers, mockZones } from "../../src/data/mockData";
import { mockLeaderboardGlobal, mockLeaderboardRegion } from "../../src/data/leaderboardData";

const bodySchema = z.object({
  seedUserPlayers: z.boolean().default(true),
  userId: z.string().min(1).default("demo-user"),
});

/**
 * POST /api/seed/bootstrap
 * Seeds core non-player collections used by gameplay loops:
 * - zones
 * - leaderboard_entries
 * - optional demo user_players
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

  const { seedUserPlayers, userId } = parsed.data;

  try {
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
          $setOnInsert: {
            createdAt: now,
          },
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
          $setOnInsert: {
            createdAt: now,
          },
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
            $setOnInsert: {
              createdAt: now,
            },
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown bootstrap seed error";
    return res.status(500).json({ ok: false, error: message });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdminClient } from "../../lib/supabase.js";
import {
  DB_TABLES,
  type LeaderboardEntryDoc,
  type PlayerDoc,
  type UserPlayerDoc,
  type ZoneDoc,
} from "../../lib/server/dbCollections.js";
import { mockPlayers, mockZones } from "../../src/data/mockData.js";
import { mockLeaderboardGlobal, mockLeaderboardRegion } from "../../src/data/leaderboardData.js";

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

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const existingRes = await supabase.from(DB_TABLES.players).select("externalId");
  if (existingRes.error) throw existingRes.error;
  const existing = new Set((existingRes.data ?? []).map((row) => row.externalId as string));

  const docs: PlayerDoc[] = [];
  for (const p of mockPlayers) {
    docs.push({
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
    });
  }
  const upserted = docs.filter((d) => !existing.has(d.externalId)).length;
  const updated = docs.length - upserted;
  const upsertRes = await supabase.from(DB_TABLES.players).upsert(docs, { onConflict: "externalId" });
  if (upsertRes.error) throw upsertRes.error;

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
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const zoneRows: ZoneDoc[] = [];
  for (const zone of mockZones) {
    zoneRows.push({
      zoneType: zone.type,
      name: zone.name,
      latitude: zone.lat,
      longitude: zone.lng,
      region: "CONCACAF · NA",
      rewardType: zone.benefit,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  const existingZonesRes = await supabase.from(DB_TABLES.zones).select("name");
  if (existingZonesRes.error) throw existingZonesRes.error;
  const existingZones = new Set((existingZonesRes.data ?? []).map((z) => z.name as string));
  const seededZones = zoneRows.filter((z) => !existingZones.has(z.name)).length;
  const updatedZones = zoneRows.length - seededZones;
  const zoneUpsertRes = await supabase.from(DB_TABLES.zones).upsert(zoneRows, { onConflict: "name" });
  if (zoneUpsertRes.error) throw zoneUpsertRes.error;

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

  const leaderboardRowsToWrite = [...uniq.values()];
  const existingLeaderboardRes = await supabase.from(DB_TABLES.leaderboard).select("username,region");
  if (existingLeaderboardRes.error) throw existingLeaderboardRes.error;
  const existingLeaderboard = new Set(
    (existingLeaderboardRes.data ?? []).map((r) => `${r.username as string}::${r.region as string}`)
  );
  const seededLeaderboard = leaderboardRowsToWrite.filter(
    (r) => !existingLeaderboard.has(`${r.username}::${r.region}`)
  ).length;
  const updatedLeaderboard = leaderboardRowsToWrite.length - seededLeaderboard;
  const leaderboardUpsertRes = await supabase
    .from(DB_TABLES.leaderboard)
    .upsert(leaderboardRowsToWrite, { onConflict: "username,region" });
  if (leaderboardUpsertRes.error) throw leaderboardUpsertRes.error;

  let seededUserPlayers = 0;
  let updatedUserPlayers = 0;
  if (seedUserPlayers) {
    const knownPlayersRes = await supabase.from(DB_TABLES.players).select("externalId");
    if (knownPlayersRes.error) throw knownPlayersRes.error;
    const known = new Set((knownPlayersRes.data ?? []).map((p) => p.externalId as string));
    const starters = mockPlayers.filter((p) => known.has(p.id)).slice(0, 3);
    const docs: UserPlayerDoc[] = [];
    for (const starter of starters) {
      docs.push({
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
      });
    }
    const existingUserPlayersRes = await supabase
      .from(DB_TABLES.userPlayers)
      .select("userId,playerId")
      .eq("userId", userId);
    if (existingUserPlayersRes.error) throw existingUserPlayersRes.error;
    const existingUserPlayerIds = new Set(
      (existingUserPlayersRes.data ?? []).map((r) => `${r.userId as string}::${r.playerId as string}`)
    );
    seededUserPlayers = docs.filter((d) => !existingUserPlayerIds.has(`${d.userId}::${d.playerId}`)).length;
    updatedUserPlayers = docs.length - seededUserPlayers;
    const userPlayersUpsertRes = await supabase
      .from(DB_TABLES.userPlayers)
      .upsert(docs, { onConflict: "userId,playerId" });
    if (userPlayersUpsertRes.error) throw userPlayersUpsertRes.error;
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
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return res.status(500).json({ error: message });
  }
}

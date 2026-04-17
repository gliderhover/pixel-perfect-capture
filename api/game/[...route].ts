import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdminClient } from "../../lib/supabase.js";
import { DB_TABLES } from "../../lib/server/dbCollections.js";
import { mockLiveEvents } from "../../src/data/mockData.js";
import { GeminiServiceError, requestGeminiJson } from "../../lib/gemini.js";
import {
  buildDuelPrompt,
  buildLiveEventDialoguePrompt,
  buildLocalTalentPrompt,
  buildZoneFlavorPrompt,
} from "../../lib/server/promptTemplates.js";
import { buildLocalTalentEncounters } from "../../lib/server/localTalentDiscovery.js";
import { getNearbyFootballPlaces } from "../../lib/server/placesProvider.js";

const leaderboardQuerySchema = z.object({
  scope: z.enum(["global", "region"]).optional(),
  region: z.string().min(1).optional(),
});

const leaderboardRecalcBodySchema = z.object({
  userId: z.string().min(1).optional(),
  scope: z.enum(["global", "region"]).default("global"),
  region: z.string().optional(),
});

const zonesQuerySchema = z.object({
  region: z.string().min(1).optional(),
});

const duelLineBodySchema = z.object({
  playerName: z.string().min(1),
  playerPosition: z.string().min(1),
  rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
  result: z.enum(["save", "goal"]).optional(),
});

const zoneFlavorQuerySchema = z.object({
  zoneType: z.string().min(1),
  zoneName: z.string().min(1),
  liveEventTitle: z.string().optional(),
});

const liveDialogueQuerySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  playerName: z.string().optional(),
});

const geoQuerySchema = z.object({
  lat: z.coerce.number().min(-85).max(85),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.5).max(25).optional(),
  zoom: z.coerce.number().min(3).max(19).optional(),
  limit: z.coerce.number().min(8).max(48).optional(),
  seedKey: z.string().max(100).optional(),
});

const DEV_HEALTH_ALLOW =
  process.env.NODE_ENV !== "production" || process.env.HEALTH_DEBUG_ENABLED === "1";
const DEBUG_API_LOGS = process.env.API_DEBUG_LOGS === "1" || process.env.DB_DEBUG_LOGS === "1";

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

function debugLog(message: string, payload?: Record<string, unknown>) {
  if (!DEBUG_API_LOGS) return;
  // eslint-disable-next-line no-console
  console.info("[api]", message, payload ?? {});
}

function getRouteParts(req: VercelRequest) {
  const dynamicQuery = req.query as Record<string, string | string[] | undefined>;
  const route = dynamicQuery.route ?? dynamicQuery["...route"];
  if (route) {
    return Array.isArray(route) ? route : [route];
  }
  const pathname = (req.url ?? "").split("?")[0] ?? "";
  const parts = pathname.split("/").filter(Boolean);
  const apiIdx = parts.indexOf("api");
  if (apiIdx >= 0 && parts[apiIdx + 1] === "game") {
    return parts.slice(apiIdx + 2);
  }
  return [];
}

function toArrayValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function toArrayNumber(value: string | string[] | undefined): number | undefined {
  const single = toArrayValue(value);
  if (!single) return undefined;
  const n = Number(single);
  if (Number.isNaN(n)) return undefined;
  return n;
}

function fallbackZoneFlavor(zoneType: string, zoneName: string) {
  const byType: Record<string, string> = {
    training: `${zoneName} sharpens first touch and tempo.`,
    recovery: `${zoneName} helps legs reset and minds stay calm.`,
    "fan-arena": `${zoneName} is buzzing with crowd energy.`,
    rival: `${zoneName} brings out hard duels and pride.`,
    pressure: `${zoneName} forces composure under stress.`,
    stadium: `${zoneName} feels like matchday under lights.`,
    mission: `${zoneName} hides quick opportunities for smart scouts.`,
  };
  return byType[zoneType] ?? `${zoneName} offers a focused football vibe.`;
}

function fallbackDuelLine(playerName: string, result?: "save" | "goal") {
  if (result === "save") return `${playerName}: Fair play, that was elite keeping.`;
  if (result === "goal") return `${playerName}: Net ripples. Next duel is yours to win.`;
  return `${playerName}: Penalty spot. Nerves on. Let's see your hands.`;
}

async function loadCounts() {
  const supabase = getSupabaseAdminClient();
  const [playersRes, leaderboardRes, zonesRes] = await Promise.all([
    supabase.from(DB_TABLES.players).select("externalId", { count: "exact", head: true }),
    supabase.from(DB_TABLES.leaderboard).select("username", { count: "exact", head: true }),
    supabase.from(DB_TABLES.zones).select("name", { count: "exact", head: true }),
  ]);
  if (playersRes.error) throw playersRes.error;
  if (leaderboardRes.error) throw leaderboardRes.error;
  if (zonesRes.error) throw zonesRes.error;
  return {
    playerCount: playersRes.count ?? 0,
    leaderboardCount: leaderboardRes.count ?? 0,
    zoneCount: zonesRes.count ?? 0,
  };
}

async function handleHealth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!DEV_HEALTH_ALLOW) {
    return res.status(404).json({ error: "Not found" });
  }

  const started = Date.now();
  const { playerCount, leaderboardCount, zoneCount } = await loadCounts();
  if (playerCount === 0 || leaderboardCount === 0 || zoneCount === 0) {
    debugLog("Health check found empty collection(s)", {
      players: playerCount,
      leaderboard: leaderboardCount,
      zones: zoneCount,
    });
  }
  const elapsedMs = Date.now() - started;
  return res.status(200).json({
    ok: true,
    db: "supabase",
    latencyMs: elapsedMs,
    environment: process.env.NODE_ENV ?? "development",
    collections: {
      players: playerCount,
      leaderboard: leaderboardCount,
      zones: zoneCount,
    },
  });
}

async function handleHealthCounts(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!DEV_HEALTH_ALLOW) {
    return res.status(404).json({ error: "Not found" });
  }
  const { playerCount, leaderboardCount, zoneCount } = await loadCounts();
  return res.status(200).json({
    ok: true,
    collections: {
      players: playerCount,
      leaderboard: leaderboardCount,
      zones: zoneCount,
    },
  });
}

async function handleLeaderboardList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = leaderboardQuerySchema.safeParse({
    scope: toArrayValue(req.query.scope),
    region: toArrayValue(req.query.region),
  });
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten(),
    });
  }

  const { scope, region } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (scope === "region") {
    if (!region) {
      return res.status(400).json({
        error: "region query is required when scope=region",
      });
    }
    filter.region = region;
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from(DB_TABLES.leaderboard)
    .select("*")
    .order("score", { ascending: false })
    .order("streak", { ascending: false })
    .order("updatedAt", { ascending: false });
  if (filter.region) query = query.eq("region", String(filter.region));
  const { data, error } = await query;
  if (error) throw error;
  const docs = data ?? [];

  return res.status(200).json({
    data: docs,
    count: docs.length,
    scope: scope ?? "global",
    region: region ?? null,
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
  const supabase = getSupabaseAdminClient();
  let usersQuery = supabase.from(DB_TABLES.userPlayers).select("*");
  if (userId) usersQuery = usersQuery.eq("userId", userId);
  const usersRes = await usersQuery;
  if (usersRes.error) throw usersRes.error;
  const docs = usersRes.data ?? [];
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
  const nowIso = new Date().toISOString();
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
    const upsertRes = await supabase.from(DB_TABLES.leaderboard).upsert(
      {
        username: uid,
        region: entryRegion,
        activePlayerId: active.playerId,
        score,
        streak: Math.max(1, Math.floor(active.level / 3)),
        updatedAt: nowIso,
        createdAt: nowIso,
      },
      { onConflict: "username,region" }
    );
    if (upsertRes.error) throw upsertRes.error;
    updatedCount += 1;
  }

  return res.status(200).json({
    ok: true,
    updated: updatedCount,
    scope,
    region: scope === "region" ? region ?? "CONCACAF · NA" : null,
  });
}

async function handleZones(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = zonesQuerySchema.safeParse({
    region: toArrayValue(req.query.region),
  });
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten(),
    });
  }

  const filter: Record<string, unknown> = { active: true };
  if (parsed.data.region) filter.region = parsed.data.region;

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from(DB_TABLES.zones)
    .select("*")
    .eq("active", true)
    .order("updatedAt", { ascending: false });
  if (filter.region) query = query.eq("region", String(filter.region));
  const { data, error } = await query;
  if (error) throw error;
  const docs = data ?? [];
  return res.status(200).json({
    data: docs,
    count: docs.length,
    activeOnly: true,
  });
}

async function handleLiveEvents(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(200).json({
    data: mockLiveEvents,
    count: mockLiveEvents.length,
    source: "mock-api",
  });
}

async function handleDuelLine(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const parsed = duelLineBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { playerName, playerPosition, rarity, result } = parsed.data;
  let line = fallbackDuelLine(playerName, result);
  let tags: string[] = ["fallback"];
  let source = "fallback";

  try {
    const prompt = buildDuelPrompt({
      context: { playerName, playerPosition, rarity, result },
    });
    const ai = await requestGeminiJson<{ line: string; tags?: string[] }>(
      [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      { temperature: 0.9, maxOutputTokens: 90 }
    );
    if (typeof ai.line === "string" && ai.line.trim()) {
      line = ai.line.trim();
      tags = Array.isArray(ai.tags) ? ai.tags.slice(0, 3) : [];
      source = "gemini";
    }
  } catch (error) {
    if (!(error instanceof GeminiServiceError)) throw error;
  }

  return res.status(200).json({ line, tags, source });
}

async function handleZoneFlavor(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const parsed = zoneFlavorQuerySchema.safeParse({
    zoneType: toArrayValue(req.query.zoneType),
    zoneName: toArrayValue(req.query.zoneName),
    liveEventTitle: toArrayValue(req.query.liveEventTitle),
  });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
  }
  const { zoneType, zoneName, liveEventTitle } = parsed.data;
  let flavor = fallbackZoneFlavor(zoneType, zoneName);
  let tags: string[] = ["fallback"];
  let source = "fallback";

  try {
    const prompt = buildZoneFlavorPrompt({ zoneType, zoneName, liveEventTitle });
    const ai = await requestGeminiJson<{ flavor: string; tags?: string[] }>(
      [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      { temperature: 0.8, maxOutputTokens: 80 }
    );
    if (typeof ai.flavor === "string" && ai.flavor.trim()) {
      flavor = ai.flavor.trim();
      tags = Array.isArray(ai.tags) ? ai.tags.slice(0, 3) : [];
      source = "gemini";
    }
  } catch (error) {
    if (!(error instanceof GeminiServiceError)) throw error;
  }

  return res.status(200).json({ flavor, tags, source });
}

async function handleLiveDialogue(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const parsed = liveDialogueQuerySchema.safeParse({
    title: toArrayValue(req.query.title),
    description: toArrayValue(req.query.description),
    playerName: toArrayValue(req.query.playerName),
  });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
  }
  const seedEvent = mockLiveEvents[0];
  const title = parsed.data.title ?? seedEvent?.title ?? "Live football update";
  const description = parsed.data.description ?? seedEvent?.description ?? "Momentum swings fast.";
  const playerName = parsed.data.playerName;
  let line = playerName
    ? `${playerName} tracks this moment closely.`
    : "Crowd noise rises as momentum shifts.";
  let tags: string[] = ["fallback"];
  let source = "fallback";

  try {
    const prompt = buildLiveEventDialoguePrompt({
      liveEventTitle: title,
      liveEventDescription: description,
      playerName,
    });
    const ai = await requestGeminiJson<{ line: string; tags?: string[] }>(
      [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      { temperature: 0.85, maxOutputTokens: 80 }
    );
    if (typeof ai.line === "string" && ai.line.trim()) {
      line = ai.line.trim();
      tags = Array.isArray(ai.tags) ? ai.tags.slice(0, 3) : [];
      source = "gemini";
    }
  } catch (error) {
    if (!(error instanceof GeminiServiceError)) throw error;
  }

  return res.status(200).json({ line, tags, source });
}

async function handleNearbyLocalTalents(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = geoQuerySchema.safeParse({
    lat: toArrayNumber(req.query.lat),
    lng: toArrayNumber(req.query.lng),
    radiusKm: toArrayNumber(req.query.radiusKm),
    zoom: toArrayNumber(req.query.zoom),
    limit: toArrayNumber(req.query.limit),
    seedKey: toArrayValue(req.query.seedKey),
  });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
  }

  const { lat, lng, radiusKm, zoom, limit, seedKey } = parsed.data;
  const supabase = getSupabaseAdminClient();
  const playersRes = await supabase
    .from(DB_TABLES.players)
    .select("externalId,name,portrait,age,position,representedCountry,rarity")
    .order("updatedAt", { ascending: false })
    .limit(60);
  if (playersRes.error) throw playersRes.error;
  const players = playersRes.data ?? [];

  const rows = buildLocalTalentEncounters({
    lat,
    lng,
    radiusKm,
    zoom,
    limit,
    seedKey,
    players,
  });

  // Optional AI polish: keep fallback content if generation fails.
  for (let i = 0; i < rows.length; i += 1) {
    try {
      const row = rows[i]!;
      const prompt = buildLocalTalentPrompt({
        hometown: row.hometown,
        position: row.position,
        skillStyle: row.skillStyle,
        age: row.age,
      });
      const ai = await requestGeminiJson<{ scoutingDescription: string; tags?: string[] }>(
        [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        { temperature: 0.85, maxOutputTokens: 100 }
      );
      if (typeof ai.scoutingDescription === "string" && ai.scoutingDescription.trim()) {
        row.scoutingDescription = ai.scoutingDescription.trim();
      }
      if (Array.isArray(ai.tags)) row.tags = ai.tags.slice(0, 4);
    } catch (error) {
      if (!(error instanceof GeminiServiceError)) throw error;
    }
  }

  return res.status(200).json({
    data: rows,
    count: rows.length,
    source: "local-talent-mvp",
    note: "Generated under-the-radar prospects, not real-world verified local player data.",
  });
}

async function handleNearbyPlaces(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const parsed = geoQuerySchema.safeParse({
    lat: toArrayNumber(req.query.lat),
    lng: toArrayNumber(req.query.lng),
    radiusKm: toArrayNumber(req.query.radiusKm),
  });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
  }
  const places = await getNearbyFootballPlaces(parsed.data);
  return res.status(200).json({
    data: places,
    count: places.length,
    source: "mock-provider",
  });
}

/**
 * Grouped game router.
 * Supports:
 * - GET /api/game/health
 * - GET /api/game/health/counts
 * - GET /api/game/leaderboard
 * - POST /api/game/leaderboard/recalculate
 * - GET /api/game/zones
 * - GET /api/game/live-events
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const parts = getRouteParts(req);
    const path = parts.join("/");

    if (path === "health") return await handleHealth(req, res);
    if (path === "health/counts" || path === "health-counts") return await handleHealthCounts(req, res);
    if (path === "leaderboard") return await handleLeaderboardList(req, res);
    if (path === "leaderboard/recalculate" || path === "leaderboard-recalculate") {
      return await handleLeaderboardRecalculate(req, res);
    }
    if (path === "zones") return await handleZones(req, res);
    if (path === "live-events") return await handleLiveEvents(req, res);
    if (path === "duel-line") return await handleDuelLine(req, res);
    if (path === "zone-flavor") return await handleZoneFlavor(req, res);
    if (path === "live-dialogue") return await handleLiveDialogue(req, res);
    if (path === "discovery/players-nearby" || path === "discovery-players-nearby") {
      return await handleNearbyLocalTalents(req, res);
    }
    if (path === "discovery/places-nearby" || path === "discovery-places-nearby") {
      return await handleNearbyPlaces(req, res);
    }

    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return res.status(500).json({ error: message });
  }
}

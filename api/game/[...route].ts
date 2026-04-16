import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdminClient } from "../../lib/supabase";
import { DB_TABLES } from "../../lib/server/dbCollections";
import { mockLiveEvents } from "../../src/data/mockData";

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

    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return res.status(500).json({ error: message });
  }
}

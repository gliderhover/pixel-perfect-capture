import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMongoDb } from "../lib/mongodb";
import { getLeaderboardCollection, getPlayerCollection, getZoneCollection } from "../lib/server/dbCollections";

const DEV_HEALTH_ALLOW =
  process.env.NODE_ENV !== "production" || process.env.HEALTH_DEBUG_ENABLED === "1";
const DEBUG_API_LOGS = process.env.API_DEBUG_LOGS === "1" || process.env.DB_DEBUG_LOGS === "1";

function debugLog(message: string, payload?: Record<string, unknown>) {
  if (!DEBUG_API_LOGS) return;
  // eslint-disable-next-line no-console
  console.info("[api]", message, payload ?? {});
}

/**
 * GET /api/health
 * Verifies server + Mongo connectivity + key collection counts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!DEV_HEALTH_ALLOW) {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const started = Date.now();
    const db = await getMongoDb();
    await db.command({ ping: 1 });

    const players = await getPlayerCollection(db);
    const leaderboard = await getLeaderboardCollection(db);
    const zones = await getZoneCollection(db);
    const [playerCount, leaderboardCount, zoneCount] = await Promise.all([
      players.countDocuments({}),
      leaderboard.countDocuments({}),
      zones.countDocuments({}),
    ]);

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
      db: db.databaseName,
      latencyMs: elapsedMs,
      environment: process.env.NODE_ENV ?? "development",
      collections: {
        players: playerCount,
        leaderboard: leaderboardCount,
        zones: zoneCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health route error";
    return res.status(500).json({ error: message });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMongoDb } from "../../lib/mongodb";
import { getLeaderboardCollection, getPlayerCollection, getZoneCollection } from "../../lib/server/dbCollections";

const DEV_HEALTH_ALLOW =
  process.env.NODE_ENV !== "production" || process.env.HEALTH_DEBUG_ENABLED === "1";

/**
 * GET /api/health/counts
 * Returns key collection counts for quick DB verification.
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
    const db = await getMongoDb();
    const players = await getPlayerCollection(db);
    const leaderboard = await getLeaderboardCollection(db);
    const zones = await getZoneCollection(db);

    const [playerCount, leaderboardCount, zoneCount] = await Promise.all([
      players.countDocuments({}),
      leaderboard.countDocuments({}),
      zones.countDocuments({}),
    ]);

    return res.status(200).json({
      ok: true,
      collections: {
        players: playerCount,
        leaderboard: leaderboardCount,
        zones: zoneCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown counts route error";
    return res.status(500).json({ error: message });
  }
}

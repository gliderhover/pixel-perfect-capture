import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMongoDb } from "./lib/mongodb";

/**
 * Health probe for MongoDB connectivity.
 * GET /api/health
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    return res.status(200).json({ ok: true, db: db.databaseName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MongoDB error";
    return res.status(500).json({ ok: false, error: message });
  }
}

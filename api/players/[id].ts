import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMongoDb } from "../../lib/mongodb";
import { getPlayerCollection } from "../../lib/server/dbCollections";

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

/**
 * GET /api/players/[id]
 * Looks up by externalId first, then by slug.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing player id" });
  }

  try {
    const db = await getMongoDb();
    const players = await getPlayerCollection(db);

    const doc =
      (await players.findOne({ externalId: id })) ??
      (await players.findOne({ slug: id }));

    if (!doc) {
      return res.status(404).json({ error: "Player not found" });
    }

    return res.status(200).json({ data: cleanDoc(doc) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown player lookup error";
    return res.status(500).json({ error: message });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "./lib/mongodb";
import { getPlayerCollection, playerRaritySchema } from "./models/player";

const playersQuerySchema = z.object({
  rarity: playerRaritySchema.optional(),
  position: z.string().min(1).optional(),
  representedCountry: z.string().min(1).optional(),
});

function toArrayValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

/**
 * GET /api/players
 * Optional query filters: rarity, position, representedCountry
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const parsed = playersQuerySchema.safeParse({
      rarity: toArrayValue(req.query.rarity),
      position: toArrayValue(req.query.position),
      representedCountry: toArrayValue(req.query.representedCountry),
    });

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parsed.error.flatten(),
      });
    }

    const { rarity, position, representedCountry } = parsed.data;
    const filter: Record<string, unknown> = {};
    if (rarity) filter.rarity = rarity;
    if (position) filter.position = position;
    if (representedCountry) filter.representedCountry = representedCountry;

    const db = await getMongoDb();
    const players = await getPlayerCollection(db);

    const docs = await players.find(filter).sort({ updatedAt: -1 }).toArray();
    return res.status(200).json({
      data: docs.map(cleanDoc),
      count: docs.length,
      filters: parsed.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown players error";
    return res.status(500).json({ error: message });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../../lib/mongodb";
import { getPlayerCollection } from "../../lib/server/dbCollections";

const playersQuerySchema = z.object({
  rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
  position: z.string().min(1).optional(),
  representedCountry: z.string().min(1).optional(),
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
  if (apiIdx >= 0 && parts[apiIdx + 1] === "players") {
    return parts.slice(apiIdx + 2);
  }
  return [];
}

function toArrayValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function cleanDoc<T extends Record<string, unknown>>(doc: T) {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

async function handleListPlayers(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

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
}

async function handleGetPlayerById(req: VercelRequest, res: VercelResponse, id: string) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = await getMongoDb();
  const players = await getPlayerCollection(db);
  const doc =
    (await players.findOne({ externalId: id })) ??
    (await players.findOne({ slug: id }));

  if (!doc) {
    return res.status(404).json({ error: "Player not found" });
  }

  return res.status(200).json({ data: cleanDoc(doc) });
}

/**
 * Grouped players router.
 * Supports:
 * - GET /api/players
 * - GET /api/players/:id
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const parts = getRouteParts(req);
    if (parts.length === 0 || (parts.length === 1 && parts[0] === "list")) {
      return await handleListPlayers(req, res);
    }
    if (parts.length === 1) return await handleGetPlayerById(req, res, parts[0]);
    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown players router error";
    return res.status(500).json({ error: message });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdminClient } from "../../lib/supabase.js";
import { DB_TABLES } from "../../lib/server/dbCollections.js";

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
  const supabase = getSupabaseAdminClient();
  let query = supabase.from(DB_TABLES.players).select("*").order("updatedAt", { ascending: false });
  if (rarity) query = query.eq("rarity", rarity);
  if (position) query = query.eq("position", position);
  if (representedCountry) query = query.eq("representedCountry", representedCountry);
  const { data, error } = await query;
  if (error) throw error;
  const docs = data ?? [];
  return res.status(200).json({
    data: docs,
    count: docs.length,
    filters: parsed.data,
  });
}

async function handleGetPlayerById(req: VercelRequest, res: VercelResponse, id: string) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = getSupabaseAdminClient();
  let { data: doc, error } = await supabase
    .from(DB_TABLES.players)
    .select("*")
    .eq("externalId", id)
    .maybeSingle();

  if (error) throw error;
  if (!doc) {
    const slugLookup = await supabase
      .from(DB_TABLES.players)
      .select("*")
      .eq("slug", id)
      .maybeSingle();
    if (slugLookup.error) throw slugLookup.error;
    doc = slugLookup.data;
  }

  if (!doc) {
    return res.status(404).json({ error: "Player not found" });
  }

  return res.status(200).json({ data: doc });
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
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return res.status(500).json({ error: message });
  }
}

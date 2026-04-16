import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../lib/mongodb";
import { getZoneCollection } from "../lib/server/dbCollections";

const zonesQuerySchema = z.object({
  region: z.string().min(1).optional(),
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
 * GET /api/zones
 * Returns active zones only.
 * Optional filter: region
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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

    const db = await getMongoDb();
    const zones = await getZoneCollection(db);
    const docs = await zones.find(filter).sort({ updatedAt: -1 }).toArray();

    return res.status(200).json({
      data: docs.map(cleanDoc),
      count: docs.length,
      activeOnly: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown zones error";
    return res.status(500).json({ error: message });
  }
}

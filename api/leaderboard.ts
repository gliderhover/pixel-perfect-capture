import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "./lib/mongodb";
import { getLeaderboardCollection } from "./models/leaderboardEntry";

const leaderboardQuerySchema = z.object({
  scope: z.enum(["global", "region"]).optional(),
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
 * GET /api/leaderboard
 * Optional query:
 * - scope=global|region
 * - region=<label> (used when scope=region)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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

    const db = await getMongoDb();
    const leaderboard = await getLeaderboardCollection(db);
    const docs = await leaderboard
      .find(filter)
      .sort({ score: -1, streak: -1, updatedAt: -1 })
      .toArray();

    return res.status(200).json({
      data: docs.map(cleanDoc),
      count: docs.length,
      scope: scope ?? "global",
      region: region ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown leaderboard error";
    return res.status(500).json({ error: message });
  }
}

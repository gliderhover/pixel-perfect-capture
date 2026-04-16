import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getMongoDb } from "../lib/mongodb";
import { getUserPlayerCollection } from "../lib/server/dbCollections";

const querySchema = z.object({
  userId: z.string().min(1),
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
 * GET /api/user-players?userId=demo-user
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const parsed = querySchema.safeParse({ userId: toArrayValue(req.query.userId) });
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parsed.error.flatten(),
      });
    }

    const db = await getMongoDb();
    const userPlayers = await getUserPlayerCollection(db);
    const docs = await userPlayers
      .find({ userId: parsed.data.userId })
      .sort({ updatedAt: -1 })
      .toArray();

    return res.status(200).json({
      data: docs.map(cleanDoc),
      count: docs.length,
      userId: parsed.data.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown user players error";
    return res.status(500).json({ error: message });
  }
}

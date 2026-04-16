import type { VercelRequest, VercelResponse } from "@vercel/node";
import { mockLiveEvents } from "../src/data/mockData";

/**
 * GET /api/live-events
 * Minimal mock-backed contract so frontend consumes API shape.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    data: mockLiveEvents,
    count: mockLiveEvents.length,
    source: "mock-api",
  });
}

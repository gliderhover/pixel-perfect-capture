import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdminClient } from "../lib/supabase.js";
import { DB_TABLES } from "../lib/server/dbCollections.js";

const chatSchema = z.object({
  playerId: z.string().min(1),
  message: z.string().min(1),
  state: z
    .object({
      confidence: z.number().int().min(0).max(100),
      form: z.number().int().min(0).max(100),
      morale: z.number().int().min(0).max(100),
      fanBond: z.number().int().min(0).max(100),
    })
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .optional(),
});

type Delta = {
  confidence: number;
  form: number;
  morale: number;
  fanBond: number;
};

function clampDelta(v: number) {
  return Math.max(-8, Math.min(8, Math.round(v)));
}

function computeDeltas(message: string): Delta {
  const lower = message.toLowerCase();
  let confidence = 0;
  let form = 0;
  let morale = 0;
  let fanBond = 0;

  if (lower.includes("confidence") || lower.includes("belief")) confidence += 2;
  if (lower.includes("train") || lower.includes("tactic") || lower.includes("form")) form += 2;
  if (lower.includes("morale") || lower.includes("calm") || lower.includes("recovery")) morale += 2;
  if (lower.includes("fan") || lower.includes("bond") || lower.includes("support")) fanBond += 2;
  if (lower.includes("win") || lower.includes("let's go")) {
    confidence += 1;
    morale += 1;
  }
  if (lower.includes("bad") || lower.includes("lose")) {
    morale -= 1;
    confidence -= 1;
  }

  return {
    confidence: clampDelta(confidence || 1),
    form: clampDelta(form || 1),
    morale: clampDelta(morale || 1),
    fanBond: clampDelta(fanBond || 1),
  };
}

function makeReply(name: string, message: string, deltas: Delta): string {
  const mood =
    deltas.confidence + deltas.morale >= 3
      ? "I'm locked in."
      : deltas.morale < 0
        ? "I hear you. I'll reset."
        : "I'm with you.";
  return `${name}: ${mood} You said "${message}". I'll carry that into the next session.`;
}

/**
 * POST /api/chat
 * Minimal backend contract for player chat + deterministic deltas.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = chatSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

  try {
    const { playerId, message } = parsed.data;
    const supabase = getSupabaseAdminClient();
    const byExternal = await supabase
      .from(DB_TABLES.players)
      .select("*")
      .eq("externalId", playerId)
      .maybeSingle();
    if (byExternal.error) throw byExternal.error;
    const player = byExternal.data
      ?? (
        await (async () => {
          const bySlug = await supabase
            .from(DB_TABLES.players)
            .select("*")
            .eq("slug", playerId)
            .maybeSingle();
          if (bySlug.error) throw bySlug.error;
          return bySlug.data;
        })()
      );

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const attributeDeltas = computeDeltas(message);
    const reply = makeReply(player.name, message, attributeDeltas);
    return res.status(200).json({
      reply,
      attributeDeltas,
      meta: {
        model: "deterministic-rules-v1",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return res.status(500).json({ error: message });
  }
}

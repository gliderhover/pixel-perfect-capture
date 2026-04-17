import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdminClient } from "../lib/supabase.js";
import { DB_TABLES } from "../lib/server/dbCollections.js";
import { GeminiServiceError, requestGeminiJson } from "../lib/gemini.js";
import { buildChatPrompt } from "../lib/server/promptTemplates.js";
import { getPlayerFlavorPack } from "../lib/server/playerFlavorPacks.js";
import { getAntiRepetitionState, rememberAssistantReply } from "../lib/server/chatAntiRepetition.js";
import { getPlayerById } from "../src/data/mockData.js";

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
  context: z
    .object({
      zoneType: z.string().optional(),
      matchPhase: z.string().optional(),
      livePulse: z.string().optional(),
      competitiveStreak: z.number().int().optional(),
      liveEventTitle: z.string().optional(),
      trainingPhase: z.string().optional(),
      trustBond: z.number().int().min(0).max(100).optional(),
      level: z.number().int().min(1).optional(),
      evolutionStage: z.number().int().min(0).max(4).optional(),
      recentDuelResult: z.enum(["save", "goal", "loss", "win", "none"]).optional(),
      recentTrainingOutcome: z.enum(["strong", "average", "weak", "none"]).optional(),
      injuryState: z.enum(["none", "minor", "recovering"]).optional(),
      justRecruited: z.boolean().optional(),
    })
    .optional(),
});

const geminiChatResponseSchema = z.object({
  reply: z.string().min(1),
  toneTag: z.string().min(1).max(24).optional(),
  moodTag: z.string().min(1).max(24).optional(),
  relationshipDelta: z.number().int().min(-2).max(2).optional(),
  attributeDeltas: z.object({
    confidence: z.number().int().min(-3).max(3),
    form: z.number().int().min(-3).max(3),
    morale: z.number().int().min(-3).max(3),
    fanBond: z.number().int().min(-3).max(3),
  }),
  tags: z.array(z.string().min(1)).max(3).optional(),
  suggestedReplies: z.array(z.string().min(1).max(60)).min(2).max(3).optional(),
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
        ? "Tough moment. I reset quick."
        : "I hear you.";
  return `${name}: ${mood} Next rep, cleaner execution.`;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function similarityScore(a: string, b: string) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection += 1;
  }
  return intersection / Math.max(ta.size, tb.size);
}

function firstWords(text: string, count: number) {
  return text
    .trim()
    .split(/\s+/)
    .slice(0, count)
    .join(" ")
    .toLowerCase();
}

function buildMemorySummary(history: Array<{ role: "user" | "assistant"; content: string }>) {
  const recent = history.slice(-8);
  const userTopics = recent
    .filter((h) => h.role === "user")
    .map((h) => h.content.trim())
    .slice(-3);
  const assistantStance = recent
    .filter((h) => h.role === "assistant")
    .map((h) => h.content.trim())
    .slice(-2);
  if (!userTopics.length && !assistantStance.length) return "No prior context.";
  return `User focus lately: ${userTopics.join(" | ") || "none"}. Assistant recent stance: ${assistantStance.join(" | ") || "none"}.`;
}

function looksRepetitive(reply: string, recentAssistantReplies: string[]) {
  const opener = firstWords(reply, 3);
  for (const prev of recentAssistantReplies) {
    if (firstWords(prev, 3) === opener) return true;
    if (similarityScore(reply, prev) > 0.78) return true;
  }
  return false;
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
    const { playerId, message, history, state, context } = parsed.data;
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

    const fallbackDeltas = computeDeltas(message);
    let attributeDeltas = fallbackDeltas;
    let reply = makeReply(player.name, message, fallbackDeltas);
    let tags: string[] = [];
    let toneTag = "steady";
    let moodTag = "focused";
    let relationshipDelta: number | undefined;
    let suggestedReplies: string[] = [];
    let model = "deterministic-rules-v1";
    const historyTurns = history ?? [];
    const persistedAntiRep = getAntiRepetitionState(player.name);
    const recentAssistantReplies = historyTurns
      .filter((h) => h.role === "assistant")
      .map((h) => h.content)
      .slice(-4);
    const mergedRecentAssistant = [...recentAssistantReplies, ...persistedAntiRep.recentReplies].slice(0, 8);
    const blockedOpeners = [
      ...new Set([
        ...recentAssistantReplies.map((line) => firstWords(line, 3)).filter(Boolean),
        ...persistedAntiRep.blockedOpeners,
      ]),
    ].slice(0, 8);
    const memorySummary = buildMemorySummary(historyTurns);
    const rosterFallback = getPlayerById(playerId);
    const personalityText = [
      rosterFallback?.personality,
      Array.isArray(player.traits) && player.traits.length > 0
        ? `Traits: ${player.traits.slice(0, 4).join(", ")}`
        : undefined,
    ]
      .filter(Boolean)
      .join(". ");
    const catchphrases = Array.isArray(rosterFallback?.catchphrases)
      ? rosterFallback.catchphrases
      : ([] as string[]);
    const flavorPack = getPlayerFlavorPack({ name: player.name, rarity: player.rarity });

    const prompt = buildChatPrompt({
      identity: {
        playerName: player.name,
        playerAge: player.age,
        playerPosition: player.position,
        playerClubTeam: player.clubTeam,
        playerCountry: player.representedCountry,
        rarity: player.rarity,
        traits: Array.isArray(player.traits) ? player.traits : [],
        personality: personalityText || "focused, competitive, respectful",
        catchphrases,
      },
      gameState: {
        matchPhase: context?.matchPhase,
        zoneType: context?.zoneType ?? null,
        livePulse: context?.livePulse,
        liveEventTitle: context?.liveEventTitle ?? null,
        competitiveStreak: context?.competitiveStreak,
        trustBond: context?.trustBond,
        level: context?.level,
        evolutionStage: context?.evolutionStage,
        trainingPhase: context?.trainingPhase,
        recentDuelResult: context?.recentDuelResult,
        recentTrainingOutcome: context?.recentTrainingOutcome,
        injuryState: context?.injuryState,
        justRecruited: context?.justRecruited,
        playerState: state,
      },
      flavorPack,
      history: historyTurns,
      memorySummary,
      recentAssistantReplies: mergedRecentAssistant,
      blockedOpeners,
      userMessage: message,
    });

    try {
      const aiResponse = await requestGeminiJson<z.infer<typeof geminiChatResponseSchema>>(
        [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        { temperature: 0.92, maxOutputTokens: 240 }
      );
      const validated = geminiChatResponseSchema.safeParse(aiResponse);
      if (validated.success) {
        const candidate = validated.data.reply.trim();
        if (candidate && !looksRepetitive(candidate, mergedRecentAssistant)) {
          reply = candidate;
          attributeDeltas = validated.data.attributeDeltas;
          tags = validated.data.tags ?? [];
          toneTag = validated.data.toneTag ?? toneTag;
          moodTag = validated.data.moodTag ?? moodTag;
          relationshipDelta = validated.data.relationshipDelta;
          suggestedReplies = validated.data.suggestedReplies ?? [];
          model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
        } else {
          const retryResponse = await requestGeminiJson<z.infer<typeof geminiChatResponseSchema>>(
            [
              { role: "system", content: prompt.system },
              {
                role: "user",
                content: `${prompt.user}\nRegeneration instruction: avoid any repeated opener or sentence rhythm from recent assistant lines.`,
              },
            ],
            { temperature: 0.95, maxOutputTokens: 240 }
          );
          const retry = geminiChatResponseSchema.safeParse(retryResponse);
          if (retry.success && retry.data.reply.trim()) {
            reply = retry.data.reply.trim();
            attributeDeltas = retry.data.attributeDeltas;
            tags = retry.data.tags ?? [];
            toneTag = retry.data.toneTag ?? toneTag;
            moodTag = retry.data.moodTag ?? moodTag;
            relationshipDelta = retry.data.relationshipDelta;
            suggestedReplies = retry.data.suggestedReplies ?? [];
            model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
          }
        }
      }
    } catch (error) {
      if (!(error instanceof GeminiServiceError)) {
        // ignore unknown AI failures, fallback to deterministic response
      }
    }

    if (suggestedReplies.length === 0) {
      const byZone =
        context?.zoneType === "recovery"
          ? ["How's your body now?", "Need a lighter plan?", "What helps your reset?"]
          : context?.zoneType === "rival"
            ? ["Talk rivalry mindset", "Where do we exploit them?", "How aggressive should we be?"]
            : context?.zoneType === "training"
              ? ["What should we drill next?", "Confidence or form first?", "Give me one sharp cue"]
              : ["How's your confidence?", "What's the match plan?", "Anything to improve now?"];
      suggestedReplies = byZone;
    }
    rememberAssistantReply(player.name, reply);

    return res.status(200).json({
      reply,
      attributeDeltas,
      tags,
      toneTag,
      moodTag,
      relationshipDelta,
      suggestedReplies,
      meta: {
        model,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return res.status(500).json({ error: message });
  }
}

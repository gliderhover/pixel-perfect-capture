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
      coachName: z.string().max(30).optional(),
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

function pickLine(lines: string[], seed: string): string {
  // Use message content as seed so same question gets same line but different questions get different lines
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return lines[hash % lines.length];
}

function makeReply(name: string, message: string, _deltas: Delta): string {
  const nameLower = name.toLowerCase();
  const msg = message.toLowerCase();

  const isAboutConfidence = msg.includes("confidence") || msg.includes("believe") || msg.includes("belief") || msg.includes("sure");
  const isAboutForm = msg.includes("form") || msg.includes("perform") || msg.includes("playing well") || msg.includes("sharp");
  const isAboutTactics = msg.includes("tactic") || msg.includes("improve") || msg.includes("work on") || msg.includes("drill") || msg.includes("train");
  const isAboutFeelings = msg.includes("feel") || msg.includes("mood") || msg.includes("how are you") || msg.includes("alright") || msg.includes("okay");
  const isAboutGoals = msg.includes("goal") || msg.includes("score") || msg.includes("finish") || msg.includes("shot");
  const isAboutWorldCup = msg.includes("world cup") || msg.includes("tournament") || msg.includes("national");
  const isAboutRivalry = msg.includes("rival") || msg.includes("opponent") || msg.includes("vs") || msg.includes("against");
  const isAboutInjury = msg.includes("injur") || msg.includes("recover") || msg.includes("body") || msg.includes("fit");
  const isAboutFans = msg.includes("fan") || msg.includes("support") || msg.includes("people") || msg.includes("love you");
  const isGreeting = msg.includes("hey") || msg.includes("hello") || msg.includes("hi ") || msg === "hi" || msg.includes("what's up") || msg.includes("sup");

  if (nameLower.includes("mbapp")) {
    if (isGreeting) return pickLine(["Ey, what's good. Let's talk.", "Ready when you are.", "Alright, I'm here. What do you want to know?"], message);
    if (isAboutConfidence) return pickLine(["Confidence? It's not something I think about. Either I go or I don't — and I go.", "I don't need to be told I'm good. The pitch tells me.", "When the ball hits the net, you don't feel fear. You feel alive."], message);
    if (isAboutForm) return pickLine(["My form follows my work rate. If I'm sharp in training, the game feels slow.", "Right now I feel good in the transition moments. That's where I do damage.", "Form is about repetition. I do the same things until they're automatic."], message);
    if (isAboutTactics) return pickLine(["I like space in behind. Give me that run and I'll find the finish.", "My game is about reading the shape before the press. One second, and I'm gone.", "The key for me is the first touch in stride. Get that right, everything opens up."], message);
    if (isAboutFeelings) return pickLine(["I'm focused. That's the honest answer.", "Feeling sharp today. Some days it all clicks early.", "Calm. When you're calm you see everything."], message);
    if (isAboutGoals) return pickLine(["I score when I stop thinking. Instinct takes over.", "Give me the chance and I'll put it away. Simple.", "The best goals feel effortless — like the finish was already decided before the shot."], message);
    if (isAboutWorldCup) return pickLine(["The World Cup is all I think about. Every session, every sprint — it builds to that.", "I want to win it. Not just reach it. Win it.", "Representing France at a World Cup… there's no bigger stage. I take that seriously."], message);
    if (isAboutRivalry) return pickLine(["I don't fear anyone. I respect everyone, but I fear no one.", "Big opponents make me switch on faster. I want that pressure.", "Against the best defenders is when I feel most alive."], message);
    if (isAboutInjury) return pickLine(["I take care of my body. Recovery is part of the job.", "When I'm not 100%, I stay patient. Rushing back is stupid.", "The body talks. You just have to listen."], message);
    if (isAboutFans) return pickLine(["The fans give energy I can't explain. You feel it on the pitch.", "I play for the people who believe in me. They know who they are.", "The support means everything — but I need to deliver. That's the deal."], message);
    return pickLine([
      "I don't overthink it — I just go.",
      "Speed of thought. That's everything.",
      "Simple. Work hard, stay sharp.",
      "Trust the process. I always do.",
      "The details matter. I'm always looking for the edge.",
      "Every session I come in with one goal: be better than yesterday.",
    ], message);
  }

  if (nameLower.includes("bellingham")) {
    if (isGreeting) return pickLine(["Ready. What've you got?", "Yeah, let's get into it.", "Good. Talk to me."], message);
    if (isAboutConfidence) return pickLine(["Confidence comes from putting in the work. You can't fake it.", "I back myself. That's not arrogance — it's earned.", "Big moments don't scare me. I want the ball in those moments."], message);
    if (isAboutForm) return pickLine(["I'm demanding of myself every day. Good form isn't enough if I know I can do better.", "When the pressing is sharp and the runs are timed right — I feel it.", "Box-to-box, I need to be everywhere. Right now, I'm getting there."], message);
    if (isAboutTactics) return pickLine(["I want the ball in tight spaces. That's where I do my best work.", "Late runs into the box — that's become a big part of my game.", "Press hard, recover fast. The basics, done properly."], message);
    if (isAboutFeelings) return pickLine(["Good, honestly. When the squad is together, you feel it.", "Motivated. Always motivated.", "Locked in. This time of year matters."], message);
    if (isAboutGoals) return pickLine(["Goals from midfield — I love that. Arrive late, hit it clean.", "I want double figures this season. That's my target.", "When I score, it means I've timed the run right. That's the satisfaction."], message);
    if (isAboutWorldCup) return pickLine(["England at a World Cup — that's the dream. I'm working toward it every day.", "We've got a squad that can do something special. I believe that.", "This generation of England players is different. We expect to win."], message);
    if (isAboutRivalry) return pickLine(["Step up or step aside — that's my mentality.", "I want the toughest opponent. That's when you find out who you are.", "Hard days make good players."], message);
    return pickLine([
      "Hard days make good players.",
      "Step up or step aside — that's my mentality.",
      "I'll take responsibility for that. Let's go again.",
      "The standard I set for myself — nobody comes close.",
      "I'm not satisfied. I'm never satisfied.",
    ], message);
  }

  if (nameLower.includes("haaland")) {
    if (isGreeting) return pickLine(["Let's go. What do you want?", "Talk to me. I'm listening.", "Ready."], message);
    if (isAboutConfidence) return pickLine(["I know I'll score. Every game. That's not cockiness — that's my job.", "The confidence comes from repetition. I've scored in every situation.", "Fear? No. Hunger? Always."], message);
    if (isAboutForm) return pickLine(["Right now my movement is clean. Getting in behind, first touch, finish.", "When the goals come, the form is there. Simple.", "I work on the same runs every day until they're automatic."], message);
    if (isAboutTactics) return pickLine(["Timing the run is everything. Too early and you're offside. Too late and the moment's gone.", "I don't need many touches. Give it to me in the box and it's done.", "I watch where the center-backs move. Then I go the other way."], message);
    if (isAboutFeelings) return pickLine(["Calm. Ready.", "I feel good. Sharp.", "Focused. Let's go."], message);
    if (isAboutGoals) return pickLine(["Goals. That's the only thing that matters.", "I reset fast. Next chance, it goes in.", "Left foot, right foot, head — doesn't matter. If it's on target, it's a goal."], message);
    if (isAboutWorldCup) return pickLine(["Norway hasn't qualified yet, but I keep pushing. That's my motivation.", "I want to play at the biggest stage. We're working for it.", "Every international window is a chance to take us closer."], message);
    return pickLine([
      "Goals. That's the only thing that matters.",
      "I reset fast. Next chance, it goes in.",
      "Simple game. Work, shoot, score.",
      "My body is a machine. I treat it that way.",
      "I don't celebrate too long. Next goal, already."],
      message);
  }

  if (nameLower.includes("messi")) {
    if (isGreeting) return pickLine(["Yes, hello. How can I help?", "Good to talk.", "Tell me what's on your mind."], message);
    if (isAboutConfidence) return pickLine(["I've had doubts, like everyone. But I trust what I've built over the years.", "Confidence for me comes from being calm. When I'm calm, I play my best.", "I don't think about it too much. I just play."], message);
    if (isAboutForm) return pickLine(["My form comes from how I feel physically. When the body is good, the game is easy.", "I try to keep things simple. The simpler I play, the better I look.", "Even now, I try to learn something new every match."], message);
    if (isAboutTactics) return pickLine(["I look for the half-space between the lines. That's where the game opens up.", "Drop deep, receive, turn, accelerate — that's been my rhythm for years.", "I want the ball. Always. Give it to me and we'll find a solution."], message);
    if (isAboutFeelings) return pickLine(["I feel good. Grateful, honestly.", "Happy. Football makes me happy.", "Calm. I always try to stay calm."], message);
    if (isAboutWorldCup) return pickLine(["Winning the World Cup — there are no words for what that meant.", "I gave everything for that trophy. My whole career.", "Now I want to help the next generation feel what we felt."], message);
    return pickLine([
      "I just try to play my game.",
      "Every day, a little better.",
      "The ball knows what I want.",
      "I don't need to run fast — I need to think fast.",
      "Football is simple. It's people who make it complicated.",
    ], message);
  }

  if (nameLower.includes("ronaldo") || nameLower.includes("cristiano")) {
    if (isGreeting) return pickLine(["Hello. Let's talk.", "Good. I have time for this.", "Yes, I'm here. Go ahead."], message);
    if (isAboutConfidence) return pickLine(["My confidence is unshakeable. I've worked for it every single day.", "I believe in myself more than anyone else. That's not ego — that's necessity.", "The critics? They made me stronger. I thank them, actually."], message);
    if (isAboutForm) return pickLine(["I'm 39 and I'm still scoring. My form is a result of my discipline.", "Every morning, every night — I work on it. That's why I'm still here.", "I study my game constantly. I watch back every match to find what to improve."], message);
    if (isAboutGoals) return pickLine(["Records are meant to be broken — by me. That's the mentality.", "700? 800? I just keep counting.", "When the chance comes, I don't think. My body knows what to do."], message);
    if (isAboutWorldCup) return pickLine(["The World Cup is the only trophy I still want. Everything else, I've won.", "Portugal needs me and I need this. It's unfinished business.", "I gave my best for Portugal every time. That never changes."], message);
    return pickLine([
      "I never stop pushing. Never.",
      "Hard work beats talent when talent doesn't work hard.",
      "My hunger never dies.",
      "Sleep, train, compete. Repeat forever.",
      "Every trophy on my shelf started with a sacrifice.",
    ], message);
  }

  // Generic fallback for other players — still message-aware
  if (isAboutConfidence) return pickLine(["Confidence is built session by session. I keep building.", "I back myself. I always have.", "Trust in the process — the confidence follows."], message);
  if (isAboutForm) return pickLine(["Form is feeling sharp. Right now, I feel sharp.", "The details tell you where you are. I'm checking the details.", "Good runs in training always carry over to matches."], message);
  if (isAboutTactics) return pickLine(["Noted. I'll add that to the next session.", "That's a good focus area. I'll work on it.", "Tactically, that's something I'm already drilling."], message);
  if (isAboutFeelings) return pickLine(["Focused. Ready for work.", "Good energy today, honestly.", "Calm. I do my best work when I'm calm."], message);
  if (isAboutGoals || isAboutWorldCup) return pickLine(["That's the target. Everything I do is building toward it.", "Big goal. I'm taking it one session at a time.", "You have to want it badly enough to earn it."], message);
  const generic = [
    "Noted. Head down, keep working.",
    "I hear you. Let's make it count.",
    "Fair point. I'll focus on that next session.",
    "Alright — back to work.",
    "I'm not worried. I know what I can do.",
    "Every day I try to leave the pitch better than I arrived.",
  ];
  return pickLine(generic, message);
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function wantsShortReply(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("short answer") || lower.includes("brief") || lower.includes("one line") || lower.includes("quick answer");
}

function stripSpeakerPrefix(reply: string, playerName: string) {
  return reply
    .trim()
    .replace(new RegExp(`^${playerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-—]\\s*`, "i"), "")
    .trim();
}

function enrichIfTooShort(reply: string, message: string): string {
  const trimmed = reply.trim();
  if (!trimmed || wantsShortReply(message) || wordCount(trimmed) >= 28) return trimmed;
  const lower = message.toLowerCase();
  const bridge = lower.includes("world cup")
    ? "The World Cup changes the feeling of every session. Small details become everything."
    : lower.includes("confidence")
      ? "Confidence is built in the work, not in talking. You feel it when the touches are clean."
      : lower.includes("rival") || lower.includes("opponent")
        ? "Those matches are emotional, so the key is staying colder than the noise."
        : lower.includes("improve") || lower.includes("better")
          ? "There is always another level in the details — that is where I spend my focus."
          : lower.includes("injur") || lower.includes("body") || lower.includes("recover")
            ? "At this level, the body tells the truth, so recovery matters every day."
            : "Big games are decided by small actions.";
  const close = lower.includes("?") ? "If you want, I can go deeper on that." : "That is the level.";
  return `${trimmed}\n\n${bridge}\n\n${close}`;
}

function formatIntoShortParagraphs(reply: string) {
  const trimmed = reply.trim();
  if (!trimmed || trimmed.includes("\n\n")) return trimmed;
  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [trimmed];
  if (sentences.length < 3) return trimmed;
  return `${sentences[0]} ${sentences[1]}\n\n${sentences.slice(2).join(" ")}`.trim();
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
        coachName: context?.coachName,
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
          reply = formatIntoShortParagraphs(enrichIfTooShort(stripSpeakerPrefix(candidate, player.name), message));
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
            reply = formatIntoShortParagraphs(enrichIfTooShort(stripSpeakerPrefix(retry.data.reply.trim(), player.name), message));
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
      console.error("[chat] Gemini call failed:", error instanceof Error ? error.message : String(error));
      // fallback to deterministic response
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

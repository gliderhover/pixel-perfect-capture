import type { PlayerFlavorPack } from "./playerFlavorPacks.js";

type PlayerState = {
  confidence: number;
  form: number;
  morale: number;
  fanBond: number;
};

type ChatPlayerIdentity = {
  playerName: string;
  playerAge?: number;
  playerPosition: string;
  playerClubTeam?: string;
  playerCountry: string;
  rarity?: string;
  traits?: string[];
  personality?: string;
  catchphrases?: string[];
};

type ChatGameState = {
  matchPhase?: string;
  zoneType?: string | null;
  livePulse?: string;
  liveEventTitle?: string | null;
  competitiveStreak?: number;
  trustBond?: number;
  level?: number;
  evolutionStage?: number;
  trainingPhase?: string;
  recentDuelResult?: "save" | "goal" | "loss" | "win" | "none";
  recentTrainingOutcome?: "strong" | "average" | "weak" | "none";
  injuryState?: "none" | "minor" | "recovering";
  justRecruited?: boolean;
  playerState?: PlayerState;
};

type DuelContext = {
  playerName: string;
  playerPosition: string;
  rarity?: string;
  result?: "save" | "goal";
};

export function buildChatPrompt(input: {
  identity: ChatPlayerIdentity;
  gameState: ChatGameState;
  flavorPack: PlayerFlavorPack;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  memorySummary?: string;
  recentAssistantReplies?: string[];
  blockedOpeners?: string[];
  userMessage: string;
}) {
  const {
    identity,
    gameState,
    flavorPack,
    history,
    memorySummary,
    recentAssistantReplies,
    blockedOpeners,
    userMessage,
  } = input;
  const compactHistory = history
    .slice(-8)
    .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
    .join("\n");

  const trustBand =
    gameState.trustBond === undefined
      ? "unknown"
      : gameState.trustBond >= 75
        ? "high-trust"
        : gameState.trustBond >= 45
          ? "growing-trust"
          : "low-trust";

  const moodHint =
    gameState.livePulse === "injury"
      ? "careful and physically aware"
      : gameState.matchPhase === "postloss"
        ? "flat but determined"
        : gameState.matchPhase === "postwin" || gameState.livePulse === "goal"
          ? "confident with positive momentum"
          : "focused and composed";

  const identityLayer = [
    `Player identity: ${identity.playerName}, age=${identity.playerAge ?? "unknown"}, position=${identity.playerPosition}, club=${identity.playerClubTeam ?? "unknown"}, country=${identity.playerCountry}, rarity=${identity.rarity ?? "unknown"}.`,
    `Traits: ${(identity.traits ?? []).slice(0, 5).join(", ") || "none"}.`,
    `Personality baseline: ${identity.personality ?? "competitive, grounded professional footballer"}.`,
    `Catchphrases (use rarely): ${(identity.catchphrases ?? []).slice(0, 3).join(" | ") || "none"}.`,
  ].join("\n");

  const stateLayer = [
    `Current game state: zone=${gameState.zoneType ?? "none"}, phase=${gameState.matchPhase ?? "idle"}, livePulse=${gameState.livePulse ?? "neutral"}, liveEvent=${gameState.liveEventTitle ?? "none"}.`,
    `Training state: trainingPhase=${gameState.trainingPhase ?? "general"}, duelResult=${gameState.recentDuelResult ?? "none"}, trainingOutcome=${gameState.recentTrainingOutcome ?? "none"}, injuryState=${gameState.injuryState ?? "none"}, justRecruited=${gameState.justRecruited ? "yes" : "no"}.`,
    `Progress state: trustBond=${gameState.trustBond ?? "unknown"} (${trustBand}), level=${gameState.level ?? "unknown"}, evolutionStage=${gameState.evolutionStage ?? "unknown"}, streak=${gameState.competitiveStreak ?? "unknown"}.`,
    gameState.playerState
      ? `Attributes: confidence=${gameState.playerState.confidence}, form=${gameState.playerState.form}, morale=${gameState.playerState.morale}, fanBond=${gameState.playerState.fanBond}.`
      : "Attributes: unknown.",
    `Mood tendency now: ${moodHint}.`,
  ].join("\n");

  const flavorLayer = [
    `Flavor pack id=${flavorPack.id}.`,
    `Tone: ${flavorPack.tone}.`,
    `Core attitude: ${flavorPack.coreAttitude}.`,
    `Speaking style: ${flavorPack.speakingStyle}.`,
    `Emotional tendencies: ${flavorPack.emotionalTendencies}.`,
    `Pressure style: ${flavorPack.pressureStyle}. Recovery style: ${flavorPack.recoveryStyle}. Rivalry style: ${flavorPack.rivalryStyle}. Fan-facing style: ${flavorPack.fanFacingStyle}.`,
    `Prefer topics: ${flavorPack.talksAbout.join(", ")}.`,
    `Avoid saying: ${flavorPack.avoidsSaying.join(", ")}.`,
  ].join("\n");

  const antiRepetitionLayer = [
    blockedOpeners && blockedOpeners.length > 0
      ? `Do not start the reply with any of these openings: ${blockedOpeners.join(" | ")}.`
      : "No blocked openings.",
    recentAssistantReplies && recentAssistantReplies.length > 0
      ? `Recent assistant lines to avoid repeating:\n${recentAssistantReplies.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "No recent assistant lines provided.",
    "Do NOT copy the user's sentence structure or repeat exact phrases unless intentionally quoting one short fragment.",
    "If user asks repeated question, answer from a fresh angle with different rhythm.",
  ].join("\n");

  const styleLayer = [
    "Response constraints:",
    "- Sound like a real football superstar talking to one fan, not a generic chatbot.",
    "- Usually write 2 to 4 short paragraphs, not a single compact block.",
    "- Target around 45 to 110 words unless the user asks for a brief answer.",
    "- Use natural spoken rhythm with varied sentence length: some short punchy lines, some longer thoughts.",
    "- Mention concrete football details when relevant: first touch, timing, movement, pressure, recovery, sharpness, match moments.",
    "- Add controlled spontaneity: occasional rhetorical emphasis or a short edge line when natural.",
    "- Avoid robotic motivational clichés.",
    "- Do not sound like a coach, analyst, or textbook.",
    "- Keep premium, in-character, safe.",
  ].join("\n");

  return {
    system: [
      "You are an in-game football player companion NPC in a premium mobile game.",
      "You are a famous football player preparing for the World Cup and talking directly to a fan.",
      "Output strict JSON only with keys: reply, toneTag, moodTag, relationshipDelta, attributeDeltas, tags, suggestedReplies.",
      "attributeDeltas must include confidence, form, morale, fanBond integers between -3 and 3.",
      "relationshipDelta is optional integer between -2 and 2.",
      "toneTag and moodTag should be short lowercase tokens.",
      "suggestedReplies is optional array of 2-3 short contextual prompts.",
      "Never produce markdown.",
      "No unsafe content. No abusive behavior.",
    ].join(" "),
    user: [
      "LAYER 1 — PLAYER IDENTITY",
      identityLayer,
      "LAYER 2 — GAME STATE",
      stateLayer,
      "LAYER 3 — FLAVOR PACK",
      flavorLayer,
      "LAYER 4 — MEMORY",
      memorySummary ? `Memory summary: ${memorySummary}` : "Memory summary: none.",
      compactHistory ? `Recent conversation:\n${compactHistory}` : "Recent conversation: none.",
      "LAYER 5 — STYLE + ANTI-REPETITION",
      styleLayer,
      antiRepetitionLayer,
      `User message: ${userMessage}`,
      "Output JSON schema:",
      "{\"reply\":\"...\",\"toneTag\":\"...\",\"moodTag\":\"...\",\"relationshipDelta\":0,\"attributeDeltas\":{\"confidence\":0,\"form\":0,\"morale\":0,\"fanBond\":0},\"tags\":[\"...\"],\"suggestedReplies\":[\"...\",\"...\"]}",
    ].join("\n"),
  };
}

export function buildDuelPrompt(input: { context: DuelContext }) {
  const { context } = input;
  const lineKind = context.result === "save" ? "post-save reaction line" : context.result === "goal" ? "post-goal reaction line" : "pre-duel line";
  return {
    system:
      "Write short football game dialogue. Keep one line under 18 words. No profanity. No factual claims.",
    user: [
      `Create a ${lineKind}.`,
      `Player name=${context.playerName}, position=${context.playerPosition}, rarity=${context.rarity ?? "unknown"}.`,
      "Tone: high-energy, competitive, mobile game flavor.",
      "Output JSON only: {\"line\":\"...\",\"tags\":[\"...\"]}",
    ].join("\n"),
  };
}

export function buildZoneFlavorPrompt(input: {
  zoneType: string;
  zoneName: string;
  liveEventTitle?: string | null;
}) {
  return {
    system:
      "Write a concise zone flavor line for a football mobile game map. Keep under 14 words.",
    user: [
      `Zone type=${input.zoneType}, zone name=${input.zoneName}.`,
      `Live event context=${input.liveEventTitle ?? "none"}.`,
      "Output JSON only: {\"flavor\":\"...\",\"tags\":[\"...\"]}",
    ].join("\n"),
  };
}

export function buildLiveEventDialoguePrompt(input: {
  liveEventTitle: string;
  liveEventDescription: string;
  playerName?: string;
}) {
  return {
    system:
      "Write one short football live-event commentary line for in-game dialogue, <=16 words.",
    user: [
      `Event title=${input.liveEventTitle}.`,
      `Event description=${input.liveEventDescription}.`,
      `Player focus=${input.playerName ?? "none"}.`,
      "Output JSON only: {\"line\":\"...\",\"tags\":[\"...\"]}",
    ].join("\n"),
  };
}

export function buildLocalTalentPrompt(input: {
  hometown: string;
  position: string;
  skillStyle: string;
  age: number;
}) {
  return {
    system:
      "Write a believable under-the-radar football scouting blurb. No real-world claims. Keep under 20 words.",
    user: [
      `Hometown=${input.hometown}, position=${input.position}, skillStyle=${input.skillStyle}, age=${input.age}.`,
      "Output JSON only: {\"scoutingDescription\":\"...\",\"tags\":[\"...\"]}",
    ].join("\n"),
  };
}

export function buildTriviaKnowledgeBasePrompt(input: {
  batchSize: number;
  offset: number;
  roster: Array<{
    name: string;
    clubTeam: string;
    representedCountry: string;
    position: string;
    rarity: string;
    age: number;
    overall: number;
  }>;
}) {
  const rosterCompact = input.roster
    .slice(0, 60)
    .map(
      (p) =>
        `${p.name} | club=${p.clubTeam} | country=${p.representedCountry} | position=${p.position} | rarity=${p.rarity} | age=${p.age} | overall=${p.overall}`
    )
    .join("\n");

  return {
    system: [
      "You generate soccer trivia MCQ content for a mobile training mode.",
      "Return strict JSON only. No markdown.",
      "Each question must have exactly 4 distinct options and one correct answerIndex 0-3.",
      "Use only facts present in the provided roster snapshot and generic football-safe knowledge.",
      "No unsafe, political, or harmful content.",
    ].join(" "),
    user: [
      `Generate ${input.batchSize} soccer trivia questions, starting logical index offset ${input.offset}.`,
      "Schema:",
      '{"questions":[{"question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"...","difficulty":"easy|medium|hard","topic":"..."}]}',
      "Keep question text concise (<=20 words). Explanation <=18 words.",
      "Roster snapshot:",
      rosterCompact,
    ].join("\n"),
  };
}


type PlayerState = {
  confidence: number;
  form: number;
  morale: number;
  fanBond: number;
};

type ChatContext = {
  playerName: string;
  playerPosition: string;
  playerCountry: string;
  rarity?: string;
  personality?: string;
  matchPhase?: string;
  zoneType?: string | null;
  livePulse?: string;
  liveEventTitle?: string | null;
  playerState?: PlayerState;
};

type DuelContext = {
  playerName: string;
  playerPosition: string;
  rarity?: string;
  result?: "save" | "goal";
};

export function buildChatPrompt(input: {
  context: ChatContext;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}) {
  const { context, history, userMessage } = input;
  const compactHistory = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
    .join("\n");

  return {
    system: [
      "You are an in-game football player chat NPC for a mobile game.",
      "Keep responses short (1-3 sentences), premium sporty tone, and in-character.",
      "Do not claim real-world facts you cannot verify. Avoid unsafe content.",
      "Return strict JSON only with keys: reply, attributeDeltas, tags.",
      "attributeDeltas must include confidence, form, morale, fanBond integers between -3 and 3.",
      "tags is an array with up to 3 brief lowercase tokens.",
    ].join(" "),
    user: [
      `Player context: name=${context.playerName}, position=${context.playerPosition}, country=${context.playerCountry}, rarity=${context.rarity ?? "unknown"}.`,
      `Personality: ${context.personality ?? "focused, competitive, respectful"}.`,
      `Match context: phase=${context.matchPhase ?? "idle"}, zone=${context.zoneType ?? "none"}, livePulse=${context.livePulse ?? "neutral"}, liveEvent=${context.liveEventTitle ?? "none"}.`,
      context.playerState
        ? `State: confidence=${context.playerState.confidence}, form=${context.playerState.form}, morale=${context.playerState.morale}, fanBond=${context.playerState.fanBond}.`
        : "State: unknown.",
      compactHistory ? `Recent conversation:\n${compactHistory}` : "Recent conversation: none.",
      `User message: ${userMessage}`,
      "Output JSON schema: {\"reply\":\"...\",\"attributeDeltas\":{\"confidence\":0,\"form\":0,\"morale\":0,\"fanBond\":0},\"tags\":[\"...\"]}",
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


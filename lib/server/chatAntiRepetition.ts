type PlayerMemory = {
  recentReplies: string[];
  blockedOpeners: string[];
};

const MAX_RECENT_REPLIES = 10;
const MAX_BLOCKED_OPENERS = 10;
const playerMemory = new Map<string, PlayerMemory>();

const GLOBAL_BLOCKED_OPENERS = [
  "i'm with you",
  "i hear you",
  "let's go",
  "we got this",
  "you said",
  "i'm locked in",
];

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function firstWords(text: string, count: number) {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, count)
    .join(" ");
}

function ensureMemory(playerKey: string) {
  const key = normalize(playerKey);
  const found = playerMemory.get(key);
  if (found) return found;
  const created: PlayerMemory = { recentReplies: [], blockedOpeners: [] };
  playerMemory.set(key, created);
  return created;
}

export function getAntiRepetitionState(playerKey: string) {
  const memory = ensureMemory(playerKey);
  const blocked = [...new Set([...GLOBAL_BLOCKED_OPENERS, ...memory.blockedOpeners])].filter(Boolean);
  return {
    recentReplies: [...memory.recentReplies],
    blockedOpeners: blocked,
  };
}

export function rememberAssistantReply(playerKey: string, reply: string) {
  const memory = ensureMemory(playerKey);
  const cleaned = reply.trim();
  if (!cleaned) return;
  memory.recentReplies = [cleaned, ...memory.recentReplies.filter((r) => normalize(r) !== normalize(cleaned))].slice(
    0,
    MAX_RECENT_REPLIES
  );

  const opener = firstWords(cleaned, 3);
  if (opener) {
    memory.blockedOpeners = [opener, ...memory.blockedOpeners.filter((o) => normalize(o) !== normalize(opener))].slice(
      0,
      MAX_BLOCKED_OPENERS
    );
  }
}


import { mockPlayers } from "../../src/data/mockData.js";
import { GeminiServiceError, requestGeminiJson } from "../gemini.js";
import { buildTriviaKnowledgeBasePrompt } from "./promptTemplates.js";

export type TriviaQuestion = {
  id: string;
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  source: "gemini" | "fallback";
};

export const TRAINING_TRIVIA_CONFIG = {
  knowledgeBaseSize: 700,
  sessionQuestionCount: 10,
  questionTimeLimitSec: 5,
  passRate: 0.6,
  geminiBatchSize: 40,
  geminiBatchCount: 5,
};

let cache: TriviaQuestion[] | null = null;
let cachePromise: Promise<TriviaQuestion[]> | null = null;

function seeded(seed: number) {
  const x = Math.sin(seed * 99.1337) * 10000;
  return x - Math.floor(x);
}

function pickDistinct<T>(arr: T[], count: number, seed: number, avoid?: Set<T>): T[] {
  if (arr.length === 0) return [];
  const chosen: T[] = [];
  const blocked = avoid ? new Set(avoid) : new Set<T>();
  let step = 0;
  while (chosen.length < count && step < arr.length * 6) {
    const idx = Math.floor(seeded(seed + step * 7.17) * arr.length);
    const item = arr[idx]!;
    if (!blocked.has(item) && !chosen.includes(item)) {
      chosen.push(item);
    }
    step += 1;
  }
  return chosen;
}

function shuffle<T>(arr: T[], seed: number) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seeded(seed + i * 5.13) * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function normalizeQuestion(
  q: Partial<TriviaQuestion>,
  idx: number,
  source: "gemini" | "fallback"
): TriviaQuestion | null {
  if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) return null;
  if (typeof q.answerIndex !== "number" || q.answerIndex < 0 || q.answerIndex > 3) return null;
  const opts = q.options.map((o) => String(o ?? "").trim()).filter(Boolean);
  if (opts.length !== 4) return null;
  const uniq = new Set(opts.map((o) => o.toLowerCase()));
  if (uniq.size !== 4) return null;
  return {
    id: q.id?.trim() || `trivia-${source}-${idx}`,
    question: String(q.question).trim(),
    options: [opts[0]!, opts[1]!, opts[2]!, opts[3]!],
    answerIndex: q.answerIndex,
    explanation: String(q.explanation ?? "Football knowledge point.").trim(),
    difficulty: (q.difficulty as TriviaQuestion["difficulty"]) ?? "medium",
    topic: String(q.topic ?? "football-basics").trim(),
    source,
  };
}

function generateFallbackTriviaBank(target: number): TriviaQuestion[] {
  const clubs = [...new Set(mockPlayers.map((p) => p.clubTeam))];
  const countries = [...new Set(mockPlayers.map((p) => p.representedCountry))];
  const positions = [...new Set(mockPlayers.map((p) => p.position))];
  const rarities = ["common", "rare", "epic", "legendary"] as const;
  const out: TriviaQuestion[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (out.length < target && attempts < target * 40) {
    const i = attempts + 1;
    const p = mockPlayers[Math.floor(seeded(i * 1.11) * mockPlayers.length)]!;
    const altPlayers = pickDistinct(mockPlayers, 3, i * 2.23, new Set([p]));
    const template = attempts % 10;
    let q: TriviaQuestion | null = null;

    if (template === 0) {
      const wrong = pickDistinct(clubs, 3, i * 2.1, new Set([p.clubTeam]));
      const options = shuffle([p.clubTeam, ...wrong], i * 3.17).slice(0, 4) as [string, string, string, string];
      q = normalizeQuestion(
        {
          question: `Which club team does ${p.name} play for?`,
          options,
          answerIndex: options.indexOf(p.clubTeam),
          difficulty: "easy",
          topic: "club-teams",
          explanation: `${p.name} is listed in this game as a ${p.clubTeam} player.`,
        },
        out.length + 1,
        "fallback"
      );
    } else if (template === 1) {
      const wrong = pickDistinct(countries, 3, i * 2.8, new Set([p.representedCountry]));
      const options = shuffle([p.representedCountry, ...wrong], i * 4.01).slice(0, 4) as [
        string,
        string,
        string,
        string,
      ];
      q = normalizeQuestion(
        {
          question: `${p.name} represents which country in this roster?`,
          options,
          answerIndex: options.indexOf(p.representedCountry),
          difficulty: "easy",
          topic: "national-teams",
          explanation: `${p.name} is mapped to ${p.representedCountry}.`,
        },
        out.length + 1,
        "fallback"
      );
    } else if (template === 2) {
      const wrong = pickDistinct(positions, 3, i * 3.4, new Set([p.position]));
      const options = shuffle([p.position, ...wrong], i * 4.9).slice(0, 4) as [string, string, string, string];
      q = normalizeQuestion(
        {
          question: `What is ${p.name}'s listed position?`,
          options,
          answerIndex: options.indexOf(p.position),
          difficulty: "easy",
          topic: "positions",
          explanation: `${p.name} is a ${p.position} in the current catalog.`,
        },
        out.length + 1,
        "fallback"
      );
    } else if (template === 3) {
      const wrong = pickDistinct(rarities as unknown as string[], 3, i * 3.9, new Set([p.rarity]));
      const options = shuffle([p.rarity, ...wrong], i * 5.3).slice(0, 4) as [string, string, string, string];
      q = normalizeQuestion(
        {
          question: `Which rarity tier does ${p.name} have?`,
          options,
          answerIndex: options.indexOf(p.rarity),
          difficulty: "easy",
          topic: "rarity",
          explanation: `${p.name} is currently categorized as ${p.rarity}.`,
        },
        out.length + 1,
        "fallback"
      );
    } else if (template === 4 && altPlayers.length === 3) {
      const options = shuffle([p.name, ...altPlayers.map((x) => x.name)], i * 6.4) as [
        string,
        string,
        string,
        string,
      ];
      q = normalizeQuestion(
        {
          question: `Who plays for ${p.clubTeam}?`,
          options,
          answerIndex: options.indexOf(p.name),
          difficulty: "medium",
          topic: "club-knowledge",
          explanation: `${p.name} is the player in this list tied to ${p.clubTeam}.`,
        },
        out.length + 1,
        "fallback"
      );
    } else if (template === 5 && altPlayers.length === 3) {
      const options = shuffle([p.name, ...altPlayers.map((x) => x.name)], i * 7.1) as [
        string,
        string,
        string,
        string,
      ];
      q = normalizeQuestion(
        {
          question: `Which player represents ${p.representedCountry}?`,
          options,
          answerIndex: options.indexOf(p.name),
          difficulty: "medium",
          topic: "country-knowledge",
          explanation: `${p.name} is listed under ${p.representedCountry}.`,
        },
        out.length + 1,
        "fallback"
      );
    } else if (template === 6 && altPlayers.length === 3) {
      const options = shuffle([p.name, ...altPlayers.map((x) => x.name)], i * 7.9) as [
        string,
        string,
        string,
        string,
      ];
      q = normalizeQuestion(
        {
          question: `Who is listed as a ${p.position}?`,
          options,
          answerIndex: options.indexOf(p.name),
          difficulty: "medium",
          topic: "position-knowledge",
          explanation: `${p.name}'s catalog position is ${p.position}.`,
        },
        out.length + 1,
        "fallback"
      );
    } else if (template === 7 && altPlayers.length > 0) {
      const a = p;
      const b = altPlayers[0]!;
      const answer = a.age >= b.age ? a.name : b.name;
      const wrong = pickDistinct(
        mockPlayers.map((x) => x.name),
        2,
        i * 8.2,
        new Set([a.name, b.name])
      );
      const options = shuffle([answer, a.name === answer ? b.name : a.name, ...wrong], i * 8.7).slice(0, 4) as [
        string,
        string,
        string,
        string,
      ];
      q = normalizeQuestion(
        {
          question: `Which player is older in this roster: ${a.name} or ${b.name}?`,
          options,
          answerIndex: options.indexOf(answer),
          difficulty: "hard",
          topic: "player-age",
          explanation: `${answer} has the higher listed age between those two.`,
        },
        out.length + 1,
        "fallback"
      );
    } else if (template === 8 && altPlayers.length > 0) {
      const a = p;
      const b = altPlayers[0]!;
      const answer = a.stats.overall >= b.stats.overall ? a.name : b.name;
      const wrong = pickDistinct(
        mockPlayers.map((x) => x.name),
        2,
        i * 9.1,
        new Set([a.name, b.name])
      );
      const options = shuffle([answer, a.name === answer ? b.name : a.name, ...wrong], i * 9.4).slice(0, 4) as [
        string,
        string,
        string,
        string,
      ];
      q = normalizeQuestion(
        {
          question: `Which player has the higher OVR in this game: ${a.name} or ${b.name}?`,
          options,
          answerIndex: options.indexOf(answer),
          difficulty: "hard",
          topic: "player-ovr",
          explanation: `${answer} has the higher listed overall score in this comparison.`,
        },
        out.length + 1,
        "fallback"
      );
    } else if (template === 9) {
      const wrong = pickDistinct(countries, 3, i * 9.8, new Set([p.representedCountry]));
      const options = shuffle([p.representedCountry, ...wrong], i * 10.7).slice(0, 4) as [
        string,
        string,
        string,
        string,
      ];
      q = normalizeQuestion(
        {
          question: `${p.name} is associated with which football nation in this game database?`,
          options,
          answerIndex: options.indexOf(p.representedCountry),
          difficulty: "medium",
          topic: "roster-knowledge",
          explanation: `The roster maps ${p.name} to ${p.representedCountry}.`,
        },
        out.length + 1,
        "fallback"
      );
    }

    if (q) {
      const key = q.question.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(q);
      }
    }
    attempts += 1;
  }

  return out.slice(0, target).map((q, i) => ({ ...q, id: `trivia-fallback-${i + 1}` }));
}

async function generateGeminiTriviaBatch(batchSize: number, offset: number): Promise<TriviaQuestion[]> {
  const prompt = buildTriviaKnowledgeBasePrompt({
    batchSize,
    offset,
    roster: mockPlayers.map((p) => ({
      name: p.name,
      clubTeam: p.clubTeam,
      representedCountry: p.representedCountry,
      position: p.position,
      rarity: p.rarity,
      age: p.age,
      overall: p.stats.overall,
    })),
  });

  const ai = await requestGeminiJson<{ questions?: Array<Partial<TriviaQuestion>> }>(
    [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    { temperature: 0.6, maxOutputTokens: 4096 }
  );

  const rows = Array.isArray(ai.questions) ? ai.questions : [];
  const normalized: TriviaQuestion[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const q = normalizeQuestion(rows[i], offset + i + 1, "gemini");
    if (q) normalized.push({ ...q, id: `trivia-gemini-${offset + normalized.length + 1}` });
  }
  return normalized;
}

function dedupeByQuestion(input: TriviaQuestion[]) {
  const seen = new Set<string>();
  const out: TriviaQuestion[] = [];
  for (const q of input) {
    const key = q.question.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

async function buildTriviaKnowledgeBase(): Promise<TriviaQuestion[]> {
  const fallback = generateFallbackTriviaBank(TRAINING_TRIVIA_CONFIG.knowledgeBaseSize);
  const geminiRows: TriviaQuestion[] = [];

  try {
    for (let i = 0; i < TRAINING_TRIVIA_CONFIG.geminiBatchCount; i += 1) {
      const offset = i * TRAINING_TRIVIA_CONFIG.geminiBatchSize;
      const batch = await generateGeminiTriviaBatch(TRAINING_TRIVIA_CONFIG.geminiBatchSize, offset);
      geminiRows.push(...batch);
    }
  } catch (error) {
    if (!(error instanceof GeminiServiceError)) throw error;
  }

  const merged = dedupeByQuestion([...geminiRows, ...fallback]).slice(0, TRAINING_TRIVIA_CONFIG.knowledgeBaseSize);
  return merged.map((q, i) => ({
    ...q,
    id: `trivia-${i + 1}`,
  }));
}

export async function getSoccerTriviaKnowledgeBase() {
  if (cache) return cache;
  if (!cachePromise) {
    cachePromise = buildTriviaKnowledgeBase().then((rows) => {
      cache = rows;
      return rows;
    });
  }
  return cachePromise;
}

export function pickTriviaSession(
  bank: TriviaQuestion[],
  options?: { count?: number; seed?: string }
) {
  const count = Math.max(5, Math.min(20, options?.count ?? TRAINING_TRIVIA_CONFIG.sessionQuestionCount));
  const seedSource = options?.seed ?? `${Date.now()}`;
  let seed = 0;
  for (let i = 0; i < seedSource.length; i += 1) {
    seed = (seed << 5) - seed + seedSource.charCodeAt(i);
    seed |= 0;
  }
  const shuffled = shuffle(bank, Math.abs(seed));
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

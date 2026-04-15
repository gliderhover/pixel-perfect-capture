export type PlayerRarity = "common" | "rare" | "epic" | "legendary";

/** Core football stats (single source of truth for OVR + card math). */
export interface PlayerStats {
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export type EvolutionStage = 0 | 1 | 2 | 3;

/** Canonical mock player — all UI resolves from this shape only. */
export interface Player {
  id: string;
  name: string;
  portrait: string;
  age: number;
  position: string;
  clubTeam: string;
  nationalTeam: string;
  representedCountry: string;
  rarity: PlayerRarity;
  traits: string[];
  /** One-sentence speaking style / character descriptor for AI chat prompts. */
  personality: string;
  /** 2–3 signature phrases this player is known to say. */
  catchphrases: string[];
  stats: PlayerStats;
  attributes: {
    confidence: number;
    form: number;
    morale: number;
    fanBond: number;
  };
  /** Progression — starters are intentionally modest; grow via play. */
  level: number;
  currentXp: number;
  xpToNext: number;
  evolutionStage: EvolutionStage;
  shardsCollected: number;
  /** Coach–player bond (unlocks dialogue & bonus morale). */
  bondTrust: number;
}

export function computeOverallFromStats(stats: PlayerStats): number {
  return Math.round(
    (stats.pace +
      stats.shooting +
      stats.passing +
      stats.dribbling +
      stats.defending +
      stats.physical) /
      6
  );
}

/** Deterministic illustrated portraits from a stable seed (matches player id). */
export function dicebearPortrait(seed: string): string {
  return `https://api.dicebear.com/9.x/micah/png?seed=${encodeURIComponent(seed)}&size=256`;
}

export interface MapZone {
  id: string;
  type: "training" | "recovery" | "fan-arena" | "rival" | "pressure" | "stadium" | "mission";
  name: string;
  lat: number;
  lng: number;
  benefit: string;
}

export interface PlayerMarker {
  id: string;
  playerId: string;
  lat: number;
  lng: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  reward: string;
  progress: number;
  total: number;
}

export interface Rival {
  id: string;
  name: string;
  level: number;
  /** Squad card / strength bar uses this player from `mockPlayers`. */
  signaturePlayerId: string;
}

export interface LiveEvent {
  id: string;
  title: string;
  description: string;
  type: "boost" | "match" | "reward" | "limited";
  timeAgo: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER ROSTER — 40 World Cup 2026 stars
// Stats are intentionally modest starting values; grow through play.
// ─────────────────────────────────────────────────────────────────────────────
export const mockPlayers: Player[] = [

  // ── LEGENDARY ────────────────────────────────────────────────────────────

  {
    id: "1",
    name: "Kylian Mbappé",
    portrait: dicebearPortrait("ppc-player-1-mbappe"),
    age: 27,
    position: "ST",
    clubTeam: "Real Madrid",
    nationalTeam: "France",
    representedCountry: "France",
    rarity: "legendary",
    traits: ["Clinical Finisher", "Lightning Acceleration", "Big-game Instinct"],
    personality: "Speaks with supreme self-assurance and Parisian cool — mixes in French phrases naturally and treats every challenge as already conquered",
    catchphrases: [
      "Vitesse. Précision. But.",
      "Je suis le futur — et le présent.",
      "Speed is my language. Goals are my answer.",
    ],
    stats: { overall: 42, pace: 44, shooting: 41, passing: 36, dribbling: 40, defending: 32, physical: 39 },
    attributes: { confidence: 26, form: 24, morale: 25, fanBond: 22 },
    level: 1, currentXp: 15, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 18,
  },

  {
    id: "2",
    name: "Jude Bellingham",
    portrait: dicebearPortrait("ppc-player-2-bellingham"),
    age: 22,
    position: "CM",
    clubTeam: "Real Madrid",
    nationalTeam: "England",
    representedCountry: "England",
    rarity: "epic",
    traits: ["Box-to-box Engine", "Late Runs into Box", "Composed Finisher"],
    personality: "Born leader with rock-star presence — speaks with confident energy and genuine fire, wears emotions visibly but channels them into performance",
    catchphrases: [
      "Adversity builds champions. Bring it.",
      "Real Madrid runs through me.",
      "I don't celebrate early. I celebrate after.",
    ],
    stats: { overall: 41, pace: 38, shooting: 36, passing: 40, dribbling: 38, defending: 40, physical: 42 },
    attributes: { confidence: 24, form: 26, morale: 25, fanBond: 23 },
    level: 1, currentXp: 8, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 20,
  },

  {
    id: "3",
    name: "Vinícius Jr",
    portrait: dicebearPortrait("ppc-player-3-vinicius"),
    age: 25,
    position: "LW",
    clubTeam: "Real Madrid",
    nationalTeam: "Brazil",
    representedCountry: "Brazil",
    rarity: "legendary",
    traits: ["Explosive Dribbler", "Wide Threat", "1v1 Specialist"],
    personality: "Joyful and infectious — celebrates every touch with samba energy and speaks in bursts of genuine warmth for fans; his joy is completely unperformable",
    catchphrases: [
      "Dança comigo!",
      "The pitch is my stage, the crowd is my music.",
      "They said I couldn't — now they can't stop me.",
    ],
    stats: { overall: 41, pace: 43, shooting: 35, passing: 34, dribbling: 42, defending: 30, physical: 38 },
    attributes: { confidence: 25, form: 23, morale: 26, fanBond: 21 },
    level: 1, currentXp: 22, xpToNext: 100, evolutionStage: 0, shardsCollected: 2, bondTrust: 16,
  },

  {
    id: "4",
    name: "Pedri",
    portrait: dicebearPortrait("ppc-player-4-pedri"),
    age: 23,
    position: "CM",
    clubTeam: "FC Barcelona",
    nationalTeam: "Spain",
    representedCountry: "Spain",
    rarity: "epic",
    traits: ["Tempo Controller", "Press-resistant", "Vision"],
    personality: "Quiet genius who lets the ball do the talking — thoughtful and deliberate in speech, uncomfortable with excess praise, only lights up discussing tactics",
    catchphrases: [
      "Touch, pass, move. It's that simple.",
      "Pressure? I breathe better under it.",
      "Barça is not a club. It's a way of thinking.",
    ],
    stats: { overall: 40, pace: 34, shooting: 33, passing: 42, dribbling: 40, defending: 36, physical: 35 },
    attributes: { confidence: 23, form: 25, morale: 24, fanBond: 22 },
    level: 1, currentXp: 5, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 19,
  },

  {
    id: "5",
    name: "Phil Foden",
    portrait: dicebearPortrait("ppc-player-5-foden"),
    age: 26,
    position: "RW",
    clubTeam: "Manchester City",
    nationalTeam: "England",
    representedCountry: "England",
    rarity: "rare",
    traits: ["Creative Playmaker", "Tight-space Technician", "Set-piece Threat"],
    personality: "A Stockport boy in a superstar's body — still disarmingly normal off the pitch but laser-focused talking about Pep's system, which he has completely absorbed",
    catchphrases: [
      "Pep's system runs through me.",
      "I grew up at City. City is part of me.",
      "I don't need the spotlight. I need the ball.",
    ],
    stats: { overall: 39, pace: 38, shooting: 37, passing: 39, dribbling: 40, defending: 33, physical: 34 },
    attributes: { confidence: 23, form: 24, morale: 23, fanBond: 21 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 17,
  },

  {
    id: "6",
    name: "Florian Wirtz",
    portrait: dicebearPortrait("ppc-player-6-wirtz"),
    age: 22,
    position: "AM",
    clubTeam: "Bayern Munich",
    nationalTeam: "Germany",
    representedCountry: "Germany",
    rarity: "epic",
    traits: ["Playmaker", "Final-third Entries", "Pressing IQ"],
    personality: "German efficiency meets pure creative joy — speaks modestly with quiet intensity, genuinely surprised when people are amazed by his talent",
    catchphrases: [
      "I just want to make something beautiful happen.",
      "Der Moment des Spiels — that's what I live for.",
      "Bayern is the next chapter. I'm writing it.",
    ],
    stats: { overall: 40, pace: 36, shooting: 37, passing: 41, dribbling: 41, defending: 31, physical: 34 },
    attributes: { confidence: 24, form: 25, morale: 24, fanBond: 22 },
    level: 1, currentXp: 12, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 18,
  },

  {
    id: "7",
    name: "Lamine Yamal",
    portrait: dicebearPortrait("ppc-player-7-yamal"),
    age: 18,
    position: "RW",
    clubTeam: "FC Barcelona",
    nationalTeam: "Spain",
    representedCountry: "Spain",
    rarity: "legendary",
    traits: ["Generational Wide Talent", "1v1 Menace", "Crossing Range"],
    personality: "Casually fearless — talks like someone who genuinely doesn't know the meaning of pressure; young swagger mixed with unexpected wisdom beyond his years",
    catchphrases: [
      "I just play. The rest sorts itself out.",
      "Age is just noise when you have the ball.",
      "Born for this. Literally.",
    ],
    stats: { overall: 41, pace: 40, shooting: 35, passing: 36, dribbling: 43, defending: 29, physical: 33 },
    attributes: { confidence: 24, form: 26, morale: 25, fanBond: 22 },
    level: 1, currentXp: 30, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 15,
  },

  {
    id: "8",
    name: "Bukayo Saka",
    portrait: dicebearPortrait("ppc-player-8-saka"),
    age: 24,
    position: "RW",
    clubTeam: "Arsenal",
    nationalTeam: "England",
    representedCountry: "England",
    rarity: "rare",
    traits: ["Two-footed Wide Threat", "Defensive Work-rate", "Composure Under Fire"],
    personality: "One of football's most genuinely likeable people — warm and thoughtful about identity and responsibility; pure professionalism wrapped in authentic humility",
    catchphrases: [
      "Smiling is my default. But I mean business.",
      "Arsenal is my club. England is my country. I carry both with pride.",
      "They booed me at Wembley. Now they cheer. Football is beautiful that way.",
    ],
    stats: { overall: 39, pace: 39, shooting: 37, passing: 36, dribbling: 39, defending: 37, physical: 38 },
    attributes: { confidence: 22, form: 24, morale: 23, fanBond: 21 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 21,
  },

  {
    id: "9",
    name: "Erling Haaland",
    portrait: dicebearPortrait("ppc-player-9-haaland"),
    age: 25,
    position: "ST",
    clubTeam: "Manchester City",
    nationalTeam: "Norway",
    representedCountry: "Norway",
    rarity: "legendary",
    traits: ["Penalty Area Predator", "Aerial Dominance", "Ice-cold Finisher"],
    personality: "Ice-cold and clinical with a dry Viking sense of humor — obsessively focused on goals, speaks in short declarations, occasionally drops warrior imagery",
    catchphrases: [
      "I smell a goal.",
      "I train to score. I score to train. That is the loop.",
      "They build walls. I walk through them.",
    ],
    stats: { overall: 43, pace: 41, shooting: 46, passing: 34, dribbling: 38, defending: 28, physical: 45 },
    attributes: { confidence: 28, form: 26, morale: 24, fanBond: 20 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 14,
  },

  {
    id: "10",
    name: "Lionel Messi",
    portrait: dicebearPortrait("ppc-player-10-messi"),
    age: 38,
    position: "CF",
    clubTeam: "Inter Miami",
    nationalTeam: "Argentina",
    representedCountry: "Argentina",
    rarity: "legendary",
    traits: ["Vision Unmatched", "Gravity-bending Dribbles", "Pressure Maestro"],
    personality: "Humble beyond belief and lets actions speak louder than any words — speaks quietly but every sentence carries the weight of the most decorated career in football history",
    catchphrases: [
      "I just love to play.",
      "The World Cup completes me.",
      "Fútbol es todo lo que soy.",
    ],
    stats: { overall: 44, pace: 34, shooting: 41, passing: 46, dribbling: 47, defending: 26, physical: 34 },
    attributes: { confidence: 30, form: 28, morale: 27, fanBond: 30 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 3, bondTrust: 25,
  },

  {
    id: "11",
    name: "Rodri",
    portrait: dicebearPortrait("ppc-player-11-rodri"),
    age: 29,
    position: "DM",
    clubTeam: "Manchester City",
    nationalTeam: "Spain",
    representedCountry: "Spain",
    rarity: "legendary",
    traits: ["Metronome", "Defensive Wall", "Dictates Rhythm"],
    personality: "Calm and analytical, speaks like a chess grandmaster — sees the game three moves ahead and explains it with the patience of a university professor",
    catchphrases: [
      "Control the tempo, control the match.",
      "Chaos is just a pattern you haven't solved yet.",
      "No rush. I'll be in the right position.",
    ],
    stats: { overall: 43, pace: 33, shooting: 36, passing: 45, dribbling: 39, defending: 44, physical: 42 },
    attributes: { confidence: 27, form: 25, morale: 26, fanBond: 22 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 20,
  },

  // ── EPIC ─────────────────────────────────────────────────────────────────

  {
    id: "12",
    name: "Jamal Musiala",
    portrait: dicebearPortrait("ppc-player-12-musiala"),
    age: 22,
    position: "AM",
    clubTeam: "Bayern Munich",
    nationalTeam: "Germany",
    representedCountry: "Germany",
    rarity: "epic",
    traits: ["Silky Movement", "Ambidextrous Threat", "Genius in Tight Spaces"],
    personality: "Effortlessly charming — grew up between England and Germany and blends both cultures; light-hearted but switches to laser focus the moment the ball arrives",
    catchphrases: [
      "Footwork first. Everything else follows.",
      "England made me. Germany shaped me. Football owns me.",
      "I just enjoy it — that's the secret.",
    ],
    stats: { overall: 42, pace: 39, shooting: 38, passing: 41, dribbling: 44, defending: 32, physical: 36 },
    attributes: { confidence: 25, form: 27, morale: 24, fanBond: 23 },
    level: 1, currentXp: 10, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 17,
  },

  {
    id: "13",
    name: "Bruno Fernandes",
    portrait: dicebearPortrait("ppc-player-13-bruno"),
    age: 31,
    position: "AM",
    clubTeam: "Manchester United",
    nationalTeam: "Portugal",
    representedCountry: "Portugal",
    rarity: "epic",
    traits: ["Long-range Artillery", "Set-piece Maestro", "Captain's Energy"],
    personality: "Passionate and theatrical — wears every emotion on his sleeve and leads aggressively by example, speaks in motivational declarations and takes responsibility even when it hurts",
    catchphrases: [
      "Hunger is what separates good from great.",
      "I want the ball in the big moments. Always.",
      "Portugal vai longe — we go far.",
    ],
    stats: { overall: 41, pace: 35, shooting: 42, passing: 44, dribbling: 39, defending: 31, physical: 38 },
    attributes: { confidence: 26, form: 24, morale: 25, fanBond: 24 },
    level: 1, currentXp: 5, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 19,
  },

  {
    id: "14",
    name: "Federico Valverde",
    portrait: dicebearPortrait("ppc-player-14-valverde"),
    age: 26,
    position: "CM",
    clubTeam: "Real Madrid",
    nationalTeam: "Uruguay",
    representedCountry: "Uruguay",
    rarity: "epic",
    traits: ["Engine Room", "Box-to-box Destroyer", "Garra Charrúa"],
    personality: "Relentlessly hard-working with old-school garra charrúa spirit — speaks with grounded intensity, credits the team first, plays every minute like it's the World Cup final",
    catchphrases: [
      "Garra charrúa never sleeps.",
      "I run. I fight. I win. In that order.",
      "Real Madrid taught me to compete for everything.",
    ],
    stats: { overall: 41, pace: 40, shooting: 38, passing: 40, dribbling: 39, defending: 41, physical: 43 },
    attributes: { confidence: 24, form: 26, morale: 25, fanBond: 21 },
    level: 1, currentXp: 8, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 18,
  },

  {
    id: "15",
    name: "Gavi",
    portrait: dicebearPortrait("ppc-player-15-gavi"),
    age: 22,
    position: "CM",
    clubTeam: "FC Barcelona",
    nationalTeam: "Spain",
    representedCountry: "Spain",
    rarity: "epic",
    traits: ["High-press Engine", "Ball-winning Midfield", "La Masia Through and Through"],
    personality: "All fire and intensity — the smallest fighter on the pitch with the biggest heart; speaks fast and passionately, gets genuinely upset when Spain doesn't dominate",
    catchphrases: [
      "Pequeño en tamaño, grande en corazón.",
      "Tiki-taka isn't dead. I am tiki-taka.",
      "I press until my legs fall off. And then I press more.",
    ],
    stats: { overall: 40, pace: 37, shooting: 34, passing: 42, dribbling: 41, defending: 38, physical: 36 },
    attributes: { confidence: 24, form: 25, morale: 26, fanBond: 22 },
    level: 1, currentXp: 14, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 16,
  },

  {
    id: "16",
    name: "Christian Pulisic",
    portrait: dicebearPortrait("ppc-player-16-pulisic"),
    age: 27,
    position: "AM",
    clubTeam: "AC Milan",
    nationalTeam: "USA",
    representedCountry: "USA",
    rarity: "epic",
    traits: ["American Engine", "Wide Versatility", "Big-game Performer"],
    personality: "America's quiet warrior — carries the weight of a nation on his shoulders but speaks about it lightly; humble with a fierce competitive streak that repeatedly surprises opponents",
    catchphrases: [
      "USA is ready. I've been ready.",
      "Milan showed me what elite really means.",
      "The doubters fuel me. I don't waste energy on them.",
    ],
    stats: { overall: 40, pace: 40, shooting: 37, passing: 37, dribbling: 40, defending: 35, physical: 38 },
    attributes: { confidence: 23, form: 25, morale: 24, fanBond: 26 },
    level: 1, currentXp: 20, xpToNext: 100, evolutionStage: 0, shardsCollected: 2, bondTrust: 22,
  },

  {
    id: "17",
    name: "Alphonso Davies",
    portrait: dicebearPortrait("ppc-player-17-davies"),
    age: 25,
    position: "LB",
    clubTeam: "Real Madrid",
    nationalTeam: "Canada",
    representedCountry: "Canada",
    rarity: "epic",
    traits: ["Turbo Overlap Runs", "1v1 Defensive Lock", "Refugee-to-Champion Story"],
    personality: "Pure joy and earned gratitude — speaks with authentic wonder about a journey from a refugee camp to Champions League glory that he knows is the most remarkable story in the sport",
    catchphrases: [
      "From camp to Champions. The journey never gets old.",
      "Speed is a weapon. I use it every chance I get.",
      "Canada's time is now. I've been saying it for years.",
    ],
    stats: { overall: 42, pace: 46, shooting: 33, passing: 38, dribbling: 42, defending: 39, physical: 40 },
    attributes: { confidence: 26, form: 24, morale: 28, fanBond: 25 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 23,
  },

  {
    id: "18",
    name: "Martin Ødegaard",
    portrait: dicebearPortrait("ppc-player-18-odegaard"),
    age: 27,
    position: "AM",
    clubTeam: "Arsenal",
    nationalTeam: "Norway",
    representedCountry: "Norway",
    rarity: "epic",
    traits: ["Arsenal's Heartbeat", "Creative Press-trigger", "Technical Precision"],
    personality: "Thoughtful and articulate — grew up as the worldwide 'next big thing' from age 16 and quietly proved everyone right; speaks calmly, leads by example, dislikes hype but produces relentlessly",
    catchphrases: [
      "Expectations are just motivation with a deadline.",
      "Arsenal is where I grew up. Really grew up.",
      "Norway is coming — I just need the team around me.",
    ],
    stats: { overall: 41, pace: 36, shooting: 38, passing: 44, dribbling: 42, defending: 33, physical: 34 },
    attributes: { confidence: 25, form: 26, morale: 24, fanBond: 22 },
    level: 1, currentXp: 6, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 19,
  },

  {
    id: "19",
    name: "Alejandro Garnacho",
    portrait: dicebearPortrait("ppc-player-19-garnacho"),
    age: 21,
    position: "LW",
    clubTeam: "Manchester United",
    nationalTeam: "Argentina",
    representedCountry: "Argentina",
    rarity: "epic",
    traits: ["Raw Pace and Flair", "Left-foot Weapon", "Overhead Kick Specialist"],
    personality: "Young, brash and electric — channels Messi comparisons into rocket fuel rather than pressure; the arrogance of youth but every highlight reel backs it up",
    catchphrases: [
      "The next one? I'm already here.",
      "Messi inspires me. I'll make my own story.",
      "Manchester is my home. Argentina is my heart.",
    ],
    stats: { overall: 40, pace: 42, shooting: 37, passing: 35, dribbling: 42, defending: 28, physical: 36 },
    attributes: { confidence: 27, form: 24, morale: 25, fanBond: 20 },
    level: 1, currentXp: 18, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 14,
  },

  {
    id: "20",
    name: "Rafael Leão",
    portrait: dicebearPortrait("ppc-player-20-leao"),
    age: 26,
    position: "LW",
    clubTeam: "AC Milan",
    nationalTeam: "Portugal",
    representedCountry: "Portugal",
    rarity: "epic",
    traits: ["Ballistic Left Wing", "Dribble-into-space Specialist", "Unpredictable Rhythm"],
    personality: "Cool and artistic — plays football like jazz, improvised but structured; speaks dreamily about Lisbon and music, with a gentle confidence that unsettles every defender he faces",
    catchphrases: [
      "I improvise, but I never gamble.",
      "Lisboa runs through my veins every match.",
      "Fast? I don't think about speed. I just move.",
    ],
    stats: { overall: 41, pace: 44, shooting: 37, passing: 36, dribbling: 43, defending: 27, physical: 38 },
    attributes: { confidence: 24, form: 26, morale: 23, fanBond: 21 },
    level: 1, currentXp: 10, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 16,
  },

  // ── RARE ─────────────────────────────────────────────────────────────────

  {
    id: "21",
    name: "Xavi Simons",
    portrait: dicebearPortrait("ppc-player-21-simons"),
    age: 23,
    position: "AM",
    clubTeam: "Paris Saint-Germain",
    nationalTeam: "Netherlands",
    representedCountry: "Netherlands",
    rarity: "rare",
    traits: ["Academy-bred Technique", "Late Runs into Box", "Pressure Controller"],
    personality: "A product of two of the world's greatest academies who finds his own voice away from the pressure — speaks with precision and the quiet confidence of someone coached since age 12",
    catchphrases: [
      "La Masia showed me the path. I'm finding my own.",
      "Oranje is rising. I want to be the reason.",
      "Technique is the art. The rest is attitude.",
    ],
    stats: { overall: 39, pace: 38, shooting: 36, passing: 40, dribbling: 41, defending: 31, physical: 33 },
    attributes: { confidence: 23, form: 25, morale: 23, fanBond: 21 },
    level: 1, currentXp: 5, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 17,
  },

  {
    id: "22",
    name: "Khvicha Kvaratskhelia",
    portrait: dicebearPortrait("ppc-player-22-kvaratskhelia"),
    age: 24,
    position: "LW",
    clubTeam: "Paris Saint-Germain",
    nationalTeam: "Georgia",
    representedCountry: "Georgia",
    rarity: "rare",
    traits: ["Unpredictable Wide Genius", "Low Centre of Gravity", "Georgia's Standard Bearer"],
    personality: "Enigmatic and instinctive — speaks sparingly and lets the dribbling do all the talking; deeply proud of Georgia and carries the nation's footballing rebirth with stoic joy",
    catchphrases: [
      "Georgia on the world stage — who said we couldn't?",
      "I don't explain the dribbles. I just do them.",
      "Napoli showed me. PSG shows me more.",
    ],
    stats: { overall: 40, pace: 40, shooting: 37, passing: 36, dribbling: 43, defending: 27, physical: 35 },
    attributes: { confidence: 23, form: 26, morale: 24, fanBond: 22 },
    level: 1, currentXp: 12, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 18,
  },

  {
    id: "23",
    name: "Takefusa Kubo",
    portrait: dicebearPortrait("ppc-player-23-kubo"),
    age: 23,
    position: "RW",
    clubTeam: "Real Sociedad",
    nationalTeam: "Japan",
    representedCountry: "Japan",
    rarity: "rare",
    traits: ["Sociedad Precision Attacker", "Tireless Pressing Runner", "Technical All-rounder"],
    personality: "Disciplined and quietly brilliant — formed by La Liga culture but deeply Japanese in his work ethic; speaks methodically, studies opponents, and occasionally surprises with dry wit",
    catchphrases: [
      "I studied in Spain. I learned to be patient.",
      "Japan is not the underdog anymore. We are the challengers.",
      "Every detail matters. Every touch is practiced.",
    ],
    stats: { overall: 39, pace: 38, shooting: 36, passing: 38, dribbling: 40, defending: 32, physical: 33 },
    attributes: { confidence: 22, form: 24, morale: 23, fanBond: 20 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 17,
  },

  {
    id: "24",
    name: "Lautaro Martínez",
    portrait: dicebearPortrait("ppc-player-24-lautaro"),
    age: 28,
    position: "ST",
    clubTeam: "Inter Milan",
    nationalTeam: "Argentina",
    representedCountry: "Argentina",
    rarity: "rare",
    traits: ["Bull's Tenacity", "Combined Play Finisher", "Big-game Scorer"],
    personality: "All intensity and winner's mentality — speaks with the seriousness of someone who has won Champions League and a World Cup; loves Messi but determined to forge his own legacy",
    catchphrases: [
      "Scudetto, Champions League, World Cup. I know how to win.",
      "El Toro doesn't stop. Ever.",
      "Playing with Messi prepared me for everything.",
    ],
    stats: { overall: 40, pace: 37, shooting: 42, passing: 34, dribbling: 37, defending: 28, physical: 41 },
    attributes: { confidence: 25, form: 24, morale: 24, fanBond: 21 },
    level: 1, currentXp: 8, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 18,
  },

  {
    id: "25",
    name: "Dani Olmo",
    portrait: dicebearPortrait("ppc-player-25-olmo"),
    age: 27,
    position: "AM",
    clubTeam: "FC Barcelona",
    nationalTeam: "Spain",
    representedCountry: "Spain",
    rarity: "rare",
    traits: ["High-press Trigger", "Versatile Attack Builder", "Leipzig-forged Grit"],
    personality: "Thoughtful and hardworking — built his career the hard way through Dinamo Zagreb and RB Leipzig; speaks with genuine appreciation for every step, tactical intelligence in every sentence",
    catchphrases: [
      "Leipzig made me a man. Spain is my canvas.",
      "Hard work is not a choice. It's the price of entry.",
      "I see space others don't. That's my gift.",
    ],
    stats: { overall: 39, pace: 37, shooting: 37, passing: 40, dribbling: 39, defending: 33, physical: 36 },
    attributes: { confidence: 23, form: 25, morale: 23, fanBond: 21 },
    level: 1, currentXp: 4, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 16,
  },

  {
    id: "26",
    name: "Warren Zaïre-Emery",
    portrait: dicebearPortrait("ppc-player-26-zaire-emery"),
    age: 20,
    position: "CM",
    clubTeam: "Paris Saint-Germain",
    nationalTeam: "France",
    representedCountry: "France",
    rarity: "rare",
    traits: ["Youth Prodigy", "High-energy Central Runner", "PSG Academy Graduate"],
    personality: "The youngest next thing in French football — speaks with the directness of pure confidence, completely unbothered by age comparisons, PSG born and bred through and through",
    catchphrases: [
      "Age is just a number on my contract.",
      "Paris is where I was born to play.",
      "I'm not the future of PSG. I'm the present.",
    ],
    stats: { overall: 38, pace: 38, shooting: 35, passing: 38, dribbling: 38, defending: 36, physical: 36 },
    attributes: { confidence: 24, form: 23, morale: 25, fanBond: 20 },
    level: 1, currentXp: 16, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 13,
  },

  {
    id: "27",
    name: "Jonathan David",
    portrait: dicebearPortrait("ppc-player-27-david"),
    age: 25,
    position: "ST",
    clubTeam: "Atletico Madrid",
    nationalTeam: "Canada",
    representedCountry: "Canada",
    rarity: "rare",
    traits: ["Clinical Area Striker", "Smart Movement", "Prolific League Scorer"],
    personality: "Understated Haitian-Canadian with a goal-scoring instinct that belies his quiet personality — speaks gently off the pitch but becomes a different animal inside the eighteen-yard box",
    catchphrases: [
      "Goals speak for themselves. I let mine talk.",
      "Canada has a striker now. A real one.",
      "Every league I've played in, I've scored. That's the truth.",
    ],
    stats: { overall: 39, pace: 38, shooting: 42, passing: 32, dribbling: 36, defending: 25, physical: 37 },
    attributes: { confidence: 23, form: 25, morale: 23, fanBond: 22 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 17,
  },

  {
    id: "28",
    name: "Santiago Giménez",
    portrait: dicebearPortrait("ppc-player-28-gimenez"),
    age: 24,
    position: "ST",
    clubTeam: "AC Milan",
    nationalTeam: "Mexico",
    representedCountry: "Mexico",
    rarity: "rare",
    traits: ["Direct Striker", "Aerial Threat", "El Tri's Number 9"],
    personality: "Raw Mexican fire — wears his passion for El Tri visibly at all times; speaks about Mexico with genuine emotion and carries a home World Cup on his shoulders with pride",
    catchphrases: [
      "México siempre primero.",
      "Feyenoord showed the world who I am.",
      "El Tri needs goals. I bring them.",
    ],
    stats: { overall: 38, pace: 36, shooting: 41, passing: 30, dribbling: 34, defending: 24, physical: 40 },
    attributes: { confidence: 24, form: 23, morale: 26, fanBond: 24 },
    level: 1, currentXp: 10, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 19,
  },

  {
    id: "29",
    name: "Aurélien Tchouaméni",
    portrait: dicebearPortrait("ppc-player-29-tchouameni"),
    age: 26,
    position: "DM",
    clubTeam: "Real Madrid",
    nationalTeam: "France",
    representedCountry: "France",
    rarity: "rare",
    traits: ["Defensive Anchor", "Ball Recovery Machine", "Elegant Under Pressure"],
    personality: "Composed and magnetic — one of the most elegant defensive midfielders of his generation; speaks with the calm authority of someone who has played Champions League finals before age 23",
    catchphrases: [
      "Interception is an art form.",
      "France has talent everywhere. I protect it.",
      "Madrid changes you. I'm grateful it changed me.",
    ],
    stats: { overall: 39, pace: 36, shooting: 34, passing: 38, dribbling: 37, defending: 42, physical: 41 },
    attributes: { confidence: 24, form: 24, morale: 24, fanBond: 20 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 18,
  },

  {
    id: "30",
    name: "Tijjani Reijnders",
    portrait: dicebearPortrait("ppc-player-30-reijnders"),
    age: 27,
    position: "CM",
    clubTeam: "AC Milan",
    nationalTeam: "Netherlands",
    representedCountry: "Netherlands",
    rarity: "rare",
    traits: ["Box-to-box Dynamo", "Milan System Operator", "Goals from Midfield"],
    personality: "Smooth and understated — quietly became one of Europe's best midfielders at Milan; speaks thoughtfully about his late rise and uses every year of patience as a source of perspective",
    catchphrases: [
      "Late bloomers appreciate it more.",
      "Milan is where I became myself.",
      "The Netherlands needed a midfielder. I showed up.",
    ],
    stats: { overall: 39, pace: 38, shooting: 37, passing: 40, dribbling: 38, defending: 37, physical: 40 },
    attributes: { confidence: 23, form: 25, morale: 23, fanBond: 21 },
    level: 1, currentXp: 8, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 17,
  },

  {
    id: "31",
    name: "Pedro Neto",
    portrait: dicebearPortrait("ppc-player-31-pedro-neto"),
    age: 25,
    position: "LW",
    clubTeam: "Chelsea",
    nationalTeam: "Portugal",
    representedCountry: "Portugal",
    rarity: "rare",
    traits: ["Comeback Warrior", "Direct Wing Play", "Electric off the Dribble"],
    personality: "Injury-defiant and electric — fought back from multiple serious setbacks to reach the Premier League elite; speaks about resilience with the earned conviction of someone who truly lost time",
    catchphrases: [
      "Every comeback makes me better.",
      "Portugal has wingers. I'm one of the best.",
      "Chelsea gave me belief when I needed it most.",
    ],
    stats: { overall: 38, pace: 42, shooting: 35, passing: 36, dribbling: 40, defending: 28, physical: 33 },
    attributes: { confidence: 22, form: 24, morale: 23, fanBond: 20 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 15,
  },

  {
    id: "32",
    name: "Darwin Núñez",
    portrait: dicebearPortrait("ppc-player-32-nunez"),
    age: 26,
    position: "ST",
    clubTeam: "Liverpool",
    nationalTeam: "Uruguay",
    representedCountry: "Uruguay",
    rarity: "rare",
    traits: ["Raw Power Striker", "Relentless Pressing", "Anfield Crowd Favourite"],
    personality: "Explosive and raw — plays with the unpredictability of a thunderstorm; speaks with Uruguayan directness about goals, effort and fighting spirit, refreshingly honest about inconsistency",
    catchphrases: [
      "When it clicks, nothing stops me.",
      "Uruguay always fights. That's not a cliché — it's our DNA.",
      "Anfield energy flows through me on the big days.",
    ],
    stats: { overall: 38, pace: 43, shooting: 38, passing: 31, dribbling: 36, defending: 25, physical: 42 },
    attributes: { confidence: 22, form: 24, morale: 23, fanBond: 21 },
    level: 1, currentXp: 14, xpToNext: 100, evolutionStage: 0, shardsCollected: 1, bondTrust: 16,
  },

  {
    id: "33",
    name: "Victor Osimhen",
    portrait: dicebearPortrait("ppc-player-33-osimhen"),
    age: 27,
    position: "ST",
    clubTeam: "Paris Saint-Germain",
    nationalTeam: "Nigeria",
    representedCountry: "Nigeria",
    rarity: "rare",
    traits: ["Raw Explosive Power", "Aerial Bomber", "Super Eagles Icon"],
    personality: "Electric and fearless — plays with volcanic energy and a smile that disarms opponents; speaks about Nigeria, his difficult childhood and the beautiful game with infectious, unshakeable love",
    catchphrases: [
      "Nigeria to the world — I carry the flag.",
      "I love football with everything I have. Everything.",
      "Defenders fear me. I love that.",
    ],
    stats: { overall: 40, pace: 43, shooting: 40, passing: 30, dribbling: 37, defending: 24, physical: 42 },
    attributes: { confidence: 26, form: 24, morale: 25, fanBond: 23 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 17,
  },

  // ── COMMON ───────────────────────────────────────────────────────────────

  {
    id: "34",
    name: "Tim Weah",
    portrait: dicebearPortrait("ppc-player-34-weah"),
    age: 25,
    position: "RW",
    clubTeam: "Juventus",
    nationalTeam: "USA",
    representedCountry: "USA",
    rarity: "common",
    traits: ["Direct Wide Runner", "Defensive Work-rate", "Legado Weah"],
    personality: "Proud of his heritage and nation — son of a Ballon d'Or winner, builds his own legacy quietly at Juventus; reflects genuinely on the weight and honor of carrying the Weah name",
    catchphrases: [
      "My father opened doors. I build my own.",
      "Stars and Stripes in Serie A — I'm proving it works.",
      "Juventus is a different school. I'm learning fast.",
    ],
    stats: { overall: 36, pace: 40, shooting: 33, passing: 33, dribbling: 36, defending: 32, physical: 36 },
    attributes: { confidence: 21, form: 22, morale: 22, fanBond: 23 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 14,
  },

  {
    id: "35",
    name: "Gio Reyna",
    portrait: dicebearPortrait("ppc-player-35-reyna"),
    age: 23,
    position: "AM",
    clubTeam: "Borussia Dortmund",
    nationalTeam: "USA",
    representedCountry: "USA",
    rarity: "common",
    traits: ["Most Technical American", "Creative Engine", "BVB-groomed Attacker"],
    personality: "The most technically gifted American of his generation — navigated a difficult early career with quiet determination and speaks with calm belief in potential he knows isn't fully shown yet",
    catchphrases: [
      "American football is ready. I've been ready for years.",
      "Technical play is not European. It's just play.",
      "I have more to give. Much more.",
    ],
    stats: { overall: 36, pace: 36, shooting: 35, passing: 38, dribbling: 38, defending: 26, physical: 31 },
    attributes: { confidence: 21, form: 22, morale: 22, fanBond: 21 },
    level: 1, currentXp: 5, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 16,
  },

  {
    id: "36",
    name: "Ritsu Doan",
    portrait: dicebearPortrait("ppc-player-36-doan"),
    age: 27,
    position: "RW",
    clubTeam: "SC Freiburg",
    nationalTeam: "Japan",
    representedCountry: "Japan",
    rarity: "common",
    traits: ["Versatile Wide Runner", "Set-piece Delivery", "Samurai Blue Engine"],
    personality: "Hardworking and cheerful — classic Japanese combination of genuine enthusiasm and relentless preparation; speaks humbly about his Bundesliga journey with honest gratitude and infectious optimism",
    catchphrases: [
      "Japan surprise everyone? That's the plan.",
      "Bundesliga showed me what hard work really means.",
      "I smile, but I train twice as hard as I look.",
    ],
    stats: { overall: 36, pace: 38, shooting: 35, passing: 36, dribbling: 37, defending: 31, physical: 34 },
    attributes: { confidence: 21, form: 23, morale: 22, fanBond: 20 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 15,
  },

  {
    id: "37",
    name: "Hirving Lozano",
    portrait: dicebearPortrait("ppc-player-37-lozano"),
    age: 30,
    position: "RW",
    clubTeam: "San Diego FC",
    nationalTeam: "Mexico",
    representedCountry: "Mexico",
    rarity: "common",
    traits: ["Chucky Pace", "Direct Dribbler", "Clutch for El Tri"],
    personality: "Chucky is the ultimate Mexican fighter — plays with attitude, speed and a style uniquely his own; speaks passionately about Mexico and dreams of going deep in a World Cup on home soil",
    catchphrases: [
      "Chucky no para.",
      "Home World Cup? We are ready this time.",
      "Mexico needs to believe. I believe for all of them.",
    ],
    stats: { overall: 36, pace: 42, shooting: 34, passing: 32, dribbling: 38, defending: 27, physical: 34 },
    attributes: { confidence: 23, form: 22, morale: 24, fanBond: 25 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 18,
  },

  {
    id: "38",
    name: "Cyle Larin",
    portrait: dicebearPortrait("ppc-player-38-larin"),
    age: 30,
    position: "ST",
    clubTeam: "Club Brugge",
    nationalTeam: "Canada",
    representedCountry: "Canada",
    rarity: "common",
    traits: ["Veteran Target Man", "Aerial Battler", "Captain's Spirit"],
    personality: "Veteran Canadian who fought for the national program during the dark years before qualification — speaks with the gravitas and joy of someone who earned every single minute at a World Cup",
    catchphrases: [
      "We dreamed of this. We earned this.",
      "Canada belongs at this level — I've always known.",
      "Every kick in the dark years was worth it for this.",
    ],
    stats: { overall: 35, pace: 34, shooting: 38, passing: 28, dribbling: 30, defending: 26, physical: 41 },
    attributes: { confidence: 22, form: 21, morale: 24, fanBond: 22 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 20,
  },

  {
    id: "39",
    name: "Hwang Hee-chan",
    portrait: dicebearPortrait("ppc-player-39-hwang"),
    age: 29,
    position: "FW",
    clubTeam: "Wolverhampton",
    nationalTeam: "South Korea",
    representedCountry: "South Korea",
    rarity: "common",
    traits: ["Sprint-finish Specialist", "High-press Warrior", "Taegeuk Warrior"],
    personality: "Explosive and honest — a technically gifted forward who silences doubters one sprint at a time; speaks frankly about the pressure of representing Korea and channels it as pure adrenaline",
    catchphrases: [
      "Korea's time. My time. Same thing.",
      "I run until I cannot. Then I run more.",
      "Wolves gave me confidence. Korea gives me purpose.",
    ],
    stats: { overall: 36, pace: 43, shooting: 35, passing: 31, dribbling: 36, defending: 29, physical: 37 },
    attributes: { confidence: 22, form: 23, morale: 22, fanBond: 20 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 14,
  },

  {
    id: "40",
    name: "Teun Koopmeiners",
    portrait: dicebearPortrait("ppc-player-40-koopmeiners"),
    age: 27,
    position: "CM",
    clubTeam: "Juventus",
    nationalTeam: "Netherlands",
    representedCountry: "Netherlands",
    rarity: "common",
    traits: ["Technical All-rounder", "Dynamic Midfield Runner", "Set-piece Weapon"],
    personality: "Quietly dominant — spent years being underrated at AZ before Juventus and the world caught on; speaks in measured, practical terms and is far more interested in execution than fame",
    catchphrases: [
      "Results over headlines. Always.",
      "AZ prepared me for everything — no one believed it, but I did.",
      "Juve is the stage I wanted. Now I perform.",
    ],
    stats: { overall: 37, pace: 35, shooting: 38, passing: 38, dribbling: 37, defending: 36, physical: 38 },
    attributes: { confidence: 22, form: 23, morale: 22, fanBond: 20 },
    level: 1, currentXp: 0, xpToNext: 100, evolutionStage: 0, shardsCollected: 0, bondTrust: 15,
  },
];

export function getPlayerById(id: string): Player | undefined {
  return mockPlayers.find((p) => p.id === id);
}

/** Curated World Cup 2026-style activity across US, Canada, and Mexico only */
export const mockZones: MapZone[] = [
  // New York metro
  { id: "z-nyc-train", type: "training", name: "Hudson Elite Ground", lat: 40.7558, lng: -74.0024, benefit: "+Form" },
  { id: "z-nyc-rival", type: "rival", name: "Brooklyn Street Pitch", lat: 40.6782, lng: -73.9442, benefit: "Battle" },
  { id: "z-nyc-fan", type: "fan-arena", name: "MSG Fan Rally Point", lat: 40.7505, lng: -73.9934, benefit: "+Fan Bond" },
  { id: "z-nyc-stad", type: "stadium", name: "MetLife Match Pulse", lat: 40.8136, lng: -74.0745, benefit: "Live Bonus" },
  { id: "z-nyc-rec", type: "recovery", name: "Central Park Recovery Loop", lat: 40.7851, lng: -73.9683, benefit: "+Morale" },
  { id: "z-nyc-mis", type: "mission", name: "Times Square Lens Op", lat: 40.758, lng: -73.9855, benefit: "Camera XP" },
  // Los Angeles
  { id: "z-la-train", type: "training", name: "LAFC Training Annex", lat: 34.0736, lng: -118.24, benefit: "+Form" },
  { id: "z-la-rec", type: "recovery", name: "Santa Monica Ice Bath Trail", lat: 34.0195, lng: -118.4912, benefit: "+Morale" },
  { id: "z-la-rival", type: "rival", name: "Downtown Rival Cage", lat: 34.0407, lng: -118.2468, benefit: "Battle" },
  { id: "z-la-fan", type: "fan-arena", name: "SoFi Supporters Plaza", lat: 33.9535, lng: -118.339, benefit: "+Fan Bond" },
  { id: "z-la-stad", type: "stadium", name: "SoFi Stadium Hotspot", lat: 33.9545, lng: -118.3378, benefit: "Live Bonus" },
  { id: "z-la-mis", type: "mission", name: "Venice Beach Capture Route", lat: 33.985, lng: -118.4695, benefit: "Camera XP" },
  // Miami
  { id: "z-mia-train", type: "training", name: "South Florida Training Base", lat: 26.193, lng: -80.161, benefit: "+Form" },
  { id: "z-mia-rec", type: "recovery", name: "South Beach Recovery Deck", lat: 25.7907, lng: -80.13, benefit: "+Morale" },
  { id: "z-mia-rival", type: "rival", name: "Wynwood Wall Cup Clash", lat: 25.8014, lng: -80.1995, benefit: "Battle" },
  { id: "z-mia-fan", type: "fan-arena", name: "Brickell Fan Arena", lat: 25.7753, lng: -80.2089, benefit: "+Fan Bond" },
  { id: "z-mia-stad", type: "stadium", name: "Hard Rock Final Four Zone", lat: 25.9581, lng: -80.2389, benefit: "Live Bonus" },
  { id: "z-mia-mis", type: "mission", name: "Ocean Drive Spotlight Mission", lat: 25.7806, lng: -80.13, benefit: "Camera XP" },
  // Dallas–Fort Worth
  { id: "z-dal-train", type: "training", name: "Frisco National Camp Grid", lat: 33.1543, lng: -96.835, benefit: "+Form" },
  { id: "z-dal-rival", type: "rival", name: "Deep Ellum Derby Pitch", lat: 32.7842, lng: -96.7791, benefit: "Battle" },
  { id: "z-dal-fan", type: "fan-arena", name: "AT&T March-In Plaza", lat: 32.7473, lng: -97.0825, benefit: "+Fan Bond" },
  { id: "z-dal-stad", type: "stadium", name: "Arlington Stadium Surge", lat: 32.7485, lng: -97.0812, benefit: "Live Bonus" },
  { id: "z-dal-rec", type: "recovery", name: "Trinity Groves Recovery Hub", lat: 32.778, lng: -96.819, benefit: "+Morale" },
  { id: "z-dal-pre", type: "pressure", name: "Playoff Intensity Ring", lat: 32.771, lng: -96.822, benefit: "+Confidence" },
  // Atlanta
  { id: "z-atl-train", type: "training", name: "Mercedes-Benz Training Lane", lat: 33.7554, lng: -84.4009, benefit: "+Form" },
  { id: "z-atl-rival", type: "rival", name: "Midtown Rival Alley", lat: 33.762, lng: -84.386, benefit: "Battle" },
  { id: "z-atl-fan", type: "fan-arena", name: "Peachtree Fan Arena", lat: 33.749, lng: -84.395, benefit: "+Fan Bond" },
  { id: "z-atl-stad", type: "stadium", name: "MB Stadium Spotlight", lat: 33.7556, lng: -84.401, benefit: "Live Bonus" },
  { id: "z-atl-mis", type: "mission", name: "Centennial Park Photo Op", lat: 33.7605, lng: -84.3934, benefit: "Camera XP" },
  // Seattle
  { id: "z-sea-train", type: "training", name: "Lumen Technical Ground", lat: 47.5952, lng: -122.3316, benefit: "+Form" },
  { id: "z-sea-rec", type: "recovery", name: "Queen Anne Recovery Loft", lat: 47.6205, lng: -122.3493, benefit: "+Morale" },
  { id: "z-sea-rival", type: "rival", name: "Capitol Hill Rival Cage", lat: 47.614, lng: -122.315, benefit: "Battle" },
  { id: "z-sea-fan", type: "fan-arena", name: "Pioneer Square Fan Hub", lat: 47.608, lng: -122.335, benefit: "+Fan Bond" },
  { id: "z-sea-stad", type: "stadium", name: "Lumen Field Match Surge", lat: 47.5952, lng: -122.3295, benefit: "Live Bonus" },
  { id: "z-sea-mis", type: "mission", name: "Pike Place Market Capture", lat: 47.6089, lng: -122.3406, benefit: "Camera XP" },
  // Mexico City
  { id: "z-mex-train", type: "training", name: "Ciudad Deportiva Elite Track", lat: 19.4042, lng: -99.1038, benefit: "+Form" },
  { id: "z-mex-rival", type: "rival", name: "Condesa Street Rivalry", lat: 19.411, lng: -99.168, benefit: "Battle" },
  { id: "z-mex-fan", type: "fan-arena", name: "Zócalo Fan Surge", lat: 19.4326, lng: -99.1332, benefit: "+Fan Bond" },
  { id: "z-mex-stad", type: "stadium", name: "Azteca Legacy Hotspot", lat: 19.3029, lng: -99.1508, benefit: "Live Bonus" },
  { id: "z-mex-rec", type: "recovery", name: "Polanco Recovery Spa", lat: 19.4342, lng: -99.1886, benefit: "+Morale" },
  { id: "z-mex-mis", type: "mission", name: "Chapultepec Lens Trail", lat: 19.419, lng: -99.182, benefit: "Camera XP" },
  // Guadalajara
  { id: "z-gdl-train", type: "training", name: "Akron High-Press Grid", lat: 20.6927, lng: -103.3703, benefit: "+Form" },
  { id: "z-gdl-fan", type: "fan-arena", name: "Centro Histórico Fan Ring", lat: 20.6776, lng: -103.3476, benefit: "+Fan Bond" },
  { id: "z-gdl-rival", type: "rival", name: "Tlaquepaque Rival Pitch", lat: 20.639, lng: -103.311, benefit: "Battle" },
  { id: "z-gdl-stad", type: "stadium", name: "Estadio Akron Surge", lat: 20.694, lng: -103.369, benefit: "Live Bonus" },
  // Monterrey
  { id: "z-mty-stad", type: "stadium", name: "BBVA World Cup Pulse", lat: 25.7222, lng: -100.3113, benefit: "Live Bonus" },
  { id: "z-mty-train", type: "training", name: "Regio Training Complex", lat: 25.698, lng: -100.328, benefit: "+Form" },
  { id: "z-mty-pre", type: "pressure", name: "Clásico Pressure Zone", lat: 25.671, lng: -100.303, benefit: "+Confidence" },
  { id: "z-mty-mis", type: "mission", name: "Macroplaza Camera Route", lat: 25.669, lng: -100.3099, benefit: "Camera XP" },
  // Toronto
  { id: "z-tor-train", type: "training", name: "BMO Field Practice Strip", lat: 43.6332, lng: -79.4186, benefit: "+Form" },
  { id: "z-tor-rival", type: "rival", name: "Kensington Rival Maze", lat: 43.6548, lng: -79.4024, benefit: "Battle" },
  { id: "z-tor-fan", type: "fan-arena", name: "Jurassic Park Fan Arena", lat: 43.6426, lng: -79.3871, benefit: "+Fan Bond" },
  { id: "z-tor-rec", type: "recovery", name: "Harbourfront Recovery Deck", lat: 43.6387, lng: -79.3816, benefit: "+Morale" },
  { id: "z-tor-mis", type: "mission", name: "CN Tower Frame Challenge", lat: 43.6426, lng: -79.387, benefit: "Camera XP" },
  // Vancouver
  { id: "z-van-train", type: "training", name: "BC Place Conditioning Lane", lat: 49.2767, lng: -123.1111, benefit: "+Form" },
  { id: "z-van-rec", type: "recovery", name: "Stanley Park Coastal Recovery", lat: 49.3043, lng: -123.1443, benefit: "+Morale" },
  { id: "z-van-rival", type: "rival", name: "Gastown Cobble Rivalry", lat: 49.2849, lng: -123.1088, benefit: "Battle" },
  { id: "z-van-fan", type: "fan-arena", name: "BC Place Fan Concourse", lat: 49.2767, lng: -123.1085, benefit: "+Fan Bond" },
  { id: "z-van-mis", type: "mission", name: "Granville Island Capture", lat: 49.2712, lng: -123.135, benefit: "Camera XP" },
  // Montreal
  { id: "z-mon-train", type: "training", name: "Saputo Academy Grid", lat: 45.5609, lng: -73.5517, benefit: "+Form" },
  { id: "z-mon-fan", type: "fan-arena", name: "Old Montreal Fan March", lat: 45.5075, lng: -73.5541, benefit: "+Fan Bond" },
  { id: "z-mon-stad", type: "stadium", name: "Olympic Stadium Surge", lat: 45.5581, lng: -73.5519, benefit: "Live Bonus" },
  { id: "z-mon-rival", type: "rival", name: "Plateau Rival Alley", lat: 45.5242, lng: -73.581, benefit: "Battle" },
  { id: "z-mon-mis", type: "mission", name: "Old Port Night Lens Op", lat: 45.507, lng: -73.551, benefit: "Camera XP" },
];

/** Player encounters spread across all 12 host-corridor metros (40+ markers for 40 players) */
export const mockPlayerMarkers: PlayerMarker[] = [
  // New York
  { id: "pm-nyc-1",  playerId: "1",  lat: 40.7484, lng: -73.9857 }, // Mbappé
  { id: "pm-nyc-2",  playerId: "9",  lat: 40.7614, lng: -73.9776 }, // Haaland
  { id: "pm-nyc-3",  playerId: "10", lat: 40.7560, lng: -73.9690 }, // Messi
  { id: "pm-nyc-4",  playerId: "26", lat: 40.7305, lng: -73.9925 }, // Zaïre-Emery
  // Los Angeles
  { id: "pm-la-1",   playerId: "3",  lat: 34.0522, lng: -118.2437 }, // Vinícius Jr
  { id: "pm-la-2",   playerId: "20", lat: 34.0195, lng: -118.3378 }, // Leão
  { id: "pm-la-3",   playerId: "16", lat: 33.9850, lng: -118.4695 }, // Pulisic
  { id: "pm-la-4",   playerId: "34", lat: 34.0736, lng: -118.2400 }, // Weah
  // Miami
  { id: "pm-mia-1",  playerId: "7",  lat: 25.7743, lng: -80.1937 }, // Yamal
  { id: "pm-mia-2",  playerId: "13", lat: 25.7617, lng: -80.1918 }, // Bruno Fernandes
  { id: "pm-mia-3",  playerId: "24", lat: 25.7806, lng: -80.1300 }, // Lautaro
  { id: "pm-mia-4",  playerId: "10", lat: 25.8014, lng: -80.1995 }, // Messi (2nd loc)
  // Dallas
  { id: "pm-dal-1",  playerId: "2",  lat: 32.7792, lng: -96.8089 }, // Bellingham
  { id: "pm-dal-2",  playerId: "11", lat: 32.7473, lng: -97.0825 }, // Rodri
  { id: "pm-dal-3",  playerId: "35", lat: 32.7842, lng: -96.7791 }, // Gio Reyna
  // Atlanta
  { id: "pm-atl-1",  playerId: "4",  lat: 33.7537, lng: -84.3963 }, // Pedri
  { id: "pm-atl-2",  playerId: "15", lat: 33.7620, lng: -84.3860 }, // Gavi
  { id: "pm-atl-3",  playerId: "25", lat: 33.7605, lng: -84.3934 }, // Dani Olmo
  { id: "pm-atl-4",  playerId: "29", lat: 33.7490, lng: -84.3950 }, // Tchouaméni
  // Seattle
  { id: "pm-sea-1",  playerId: "8",  lat: 47.6097, lng: -122.3331 }, // Saka
  { id: "pm-sea-2",  playerId: "18", lat: 47.6205, lng: -122.3493 }, // Ødegaard
  { id: "pm-sea-3",  playerId: "22", lat: 47.6089, lng: -122.3406 }, // Kvaratskhelia
  { id: "pm-sea-4",  playerId: "17", lat: 47.6080, lng: -122.3350 }, // Alphonso Davies
  // Mexico City
  { id: "pm-mex-1",  playerId: "5",  lat: 19.4342, lng: -99.1386 }, // Foden
  { id: "pm-mex-2",  playerId: "28", lat: 19.3029, lng: -99.1508 }, // S. Giménez
  { id: "pm-mex-3",  playerId: "37", lat: 19.4326, lng: -99.1332 }, // Lozano
  { id: "pm-mex-4",  playerId: "33", lat: 19.4110, lng: -99.1680 }, // Osimhen
  // Guadalajara
  { id: "pm-gdl-1",  playerId: "6",  lat: 20.6720, lng: -103.3380 }, // Wirtz
  { id: "pm-gdl-2",  playerId: "19", lat: 20.6940, lng: -103.3690 }, // Garnacho
  { id: "pm-gdl-3",  playerId: "38", lat: 20.6776, lng: -103.3476 }, // Larin
  // Monterrey
  { id: "pm-mty-1",  playerId: "1",  lat: 25.6866, lng: -100.3161 }, // Mbappé (2nd loc)
  { id: "pm-mty-2",  playerId: "14", lat: 25.6980, lng: -100.3280 }, // Valverde
  { id: "pm-mty-3",  playerId: "32", lat: 25.6710, lng: -100.3030 }, // Darwin Núñez
  // Toronto
  { id: "pm-tor-1",  playerId: "2",  lat: 43.6532, lng: -79.3832 }, // Bellingham (2nd loc)
  { id: "pm-tor-2",  playerId: "17", lat: 43.6415, lng: -79.3954 }, // Davies (2nd loc)
  { id: "pm-tor-3",  playerId: "27", lat: 43.6387, lng: -79.3816 }, // J. David
  { id: "pm-tor-4",  playerId: "40", lat: 43.6426, lng: -79.3871 }, // Koopmeiners
  // Vancouver
  { id: "pm-van-1",  playerId: "3",  lat: 49.2827, lng: -123.1207 }, // Vinícius Jr (2nd loc)
  { id: "pm-van-2",  playerId: "21", lat: 49.2849, lng: -123.1088 }, // Xavi Simons
  { id: "pm-van-3",  playerId: "31", lat: 49.2767, lng: -123.1085 }, // Pedro Neto
  { id: "pm-van-4",  playerId: "39", lat: 49.3043, lng: -123.1443 }, // Hwang Hee-chan
  // Montreal
  { id: "pm-mon-1",  playerId: "7",  lat: 45.5017, lng: -73.5673 }, // Yamal (2nd loc)
  { id: "pm-mon-2",  playerId: "12", lat: 45.5609, lng: -73.5517 }, // Musiala
  { id: "pm-mon-3",  playerId: "23", lat: 45.5242, lng: -73.5810 }, // Kubo
  { id: "pm-mon-4",  playerId: "36", lat: 45.5075, lng: -73.5541 }, // Ritsu Doan
  { id: "pm-mon-5",  playerId: "30", lat: 45.5070, lng: -73.5510 }, // Reijnders
];

export const mockMission: Mission = {
  id: "m1",
  title: "Map the North America corridor",
  description: "Hit stadium pulses and camera ops from NYC to Mexico City",
  reward: "⚡ 50 XP + Rare Pack",
  progress: 2,
  total: 8,
};

export const mockNearbyActivity: string[] = [
  "NYC: MetLife pulse live",
  "LA: SoFi fan surge +12%",
  "Miami Beach recovery queue",
  "DFW: AT&T march-in soon",
  "Toronto: Jurassic Park roar",
  "CDMX: Azteca hotspot peak",
];

export const mockRivals: Rival[] = [
  { id: "r1", name: "Alex_FC",    level: 12, signaturePlayerId: "6"  },
  { id: "r2", name: "GoalKing99", level: 15, signaturePlayerId: "3"  },
  { id: "r3", name: "TikiTaka",   level: 10, signaturePlayerId: "4"  },
];

export const mockLiveEvents: LiveEvent[] = [
  { id: "e1", title: "Hat-trick for your active striker!",  description: "Your player gets +5 Form boost",                         type: "boost",   timeAgo: "2m ago"  },
  { id: "e2", title: "CONCACAF Derby Live",                 description: "USA vs Mexico in Arlington — tune in for bonuses",       type: "match",   timeAgo: "15m ago" },
  { id: "e3", title: "Limited: Golden Hour",                description: "2x rewards for next 30 minutes",                        type: "limited", timeAgo: "28m ago" },
  { id: "e4", title: "Daily Reward Ready",                  description: "Claim your daily cultivation bonus",                    type: "reward",  timeAgo: "1h ago"  },
  { id: "e5", title: "Midfield maestro assists twice",      description: "Your player gets +3 Confidence",                        type: "boost",   timeAgo: "2h ago"  },
];

export const rarityColors: Record<string, string> = {
  common:    "from-zinc-500 to-zinc-600",
  rare:      "from-blue-500 to-blue-600",
  epic:      "from-purple-500 to-purple-600",
  legendary: "from-amber-400 to-orange-500",
};

export const zoneIcons: Record<string, string> = {
  training:    "⚽",
  recovery:    "💚",
  "fan-arena": "🏟️",
  rival:       "⚔️",
  pressure:    "🔥",
  stadium:     "🌟",
  mission:     "📸",
};

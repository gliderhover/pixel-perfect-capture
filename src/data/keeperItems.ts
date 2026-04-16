export interface KeeperGloves {
  id: string;
  name: string;
  tier: "basic" | "grip" | "elite" | "legendary";
  icon: string;
  /** Extra ms added to the save timing window */
  timingBonus: number;
  /** Extra zone coverage: 0 = none, 1 = adjacent zones also count */
  diveForgiveness: number;
  description: string;
}

export interface RecruitBoost {
  id: string;
  name: string;
  icon: string;
  effect: "slow_shot" | "hint_direction" | "retry" | "bonus_odds";
  description: string;
}

export const keeperGloves: KeeperGloves[] = [
  {
    id: "basic",
    name: "Basic Gloves",
    tier: "basic",
    icon: "🧤",
    timingBonus: 0,
    diveForgiveness: 0,
    description: "Standard keeper gloves. No bonuses.",
  },
  {
    id: "grip",
    name: "Grip Gloves",
    tier: "grip",
    icon: "🧤",
    timingBonus: 150,
    diveForgiveness: 0,
    description: "+150ms reaction window.",
  },
  {
    id: "elite",
    name: "Elite Reflex Gloves",
    tier: "elite",
    icon: "⚡",
    timingBonus: 250,
    diveForgiveness: 1,
    description: "+250ms window & dive forgiveness.",
  },
  {
    id: "legendary",
    name: "Legendary Keeper Gloves",
    tier: "legendary",
    icon: "👑",
    timingBonus: 400,
    diveForgiveness: 1,
    description: "Max timing & dive range. Slow-mo assist.",
  },
];

export const recruitBoosts: RecruitBoost[] = [
  {
    id: "crowd_focus",
    name: "Crowd Focus",
    icon: "📣",
    effect: "slow_shot",
    description: "Slows the shot animation by 30%.",
  },
  {
    id: "tactical_read",
    name: "Tactical Read",
    icon: "🧠",
    effect: "hint_direction",
    description: "Briefly hints the shot direction.",
  },
  {
    id: "pressure_calm",
    name: "Pressure Calm",
    icon: "🧘",
    effect: "retry",
    description: "Grants one free retry on miss.",
  },
  {
    id: "confidence_boost",
    name: "Confidence Boost",
    icon: "🔥",
    effect: "bonus_odds",
    description: "+15% recruit success odds.",
  },
];

/** Difficulty multiplier per rarity — higher = harder (shorter windows) */
export const rarityDifficulty: Record<string, { windowMs: number; feintChance: number; shotSpeedMs: number }> = {
  common:    { windowMs: 1800, feintChance: 0,    shotSpeedMs: 900 },
  rare:      { windowMs: 1500, feintChance: 0.1,  shotSpeedMs: 750 },
  epic:      { windowMs: 1100, feintChance: 0.25, shotSpeedMs: 550 },
  legendary: { windowMs: 800,  feintChance: 0.4,  shotSpeedMs: 400 },
};

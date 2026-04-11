export interface Player {
  id: string;
  name: string;
  country: string;
  position: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  attributes: {
    confidence: number;
    form: number;
    morale: number;
    fanBond: number;
  };
  overall: number;
  image?: string;
}

export interface MapZone {
  id: string;
  type: "training" | "recovery" | "fan-arena" | "rival" | "pressure" | "stadium";
  name: string;
  x: number;
  y: number;
  benefit: string;
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
  player: string;
  overall: number;
}

export interface LiveEvent {
  id: string;
  title: string;
  description: string;
  type: "boost" | "match" | "reward" | "limited";
  timeAgo: string;
}

export const mockPlayers: Player[] = [
  { id: "1", name: "Kylian Mbappé", country: "🇫🇷", position: "ST", rarity: "legendary", overall: 95, attributes: { confidence: 92, form: 88, morale: 95, fanBond: 90 } },
  { id: "2", name: "Jude Bellingham", country: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", position: "CM", rarity: "epic", overall: 91, attributes: { confidence: 85, form: 90, morale: 88, fanBond: 82 } },
  { id: "3", name: "Vinícius Jr", country: "🇧🇷", position: "LW", rarity: "legendary", overall: 93, attributes: { confidence: 90, form: 85, morale: 92, fanBond: 95 } },
  { id: "4", name: "Pedri", country: "🇪🇸", position: "CM", rarity: "epic", overall: 89, attributes: { confidence: 80, form: 86, morale: 84, fanBond: 78 } },
  { id: "5", name: "Phil Foden", country: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", position: "RW", rarity: "rare", overall: 88, attributes: { confidence: 82, form: 84, morale: 80, fanBond: 75 } },
  { id: "6", name: "Florian Wirtz", country: "🇩🇪", position: "AM", rarity: "epic", overall: 90, attributes: { confidence: 86, form: 88, morale: 85, fanBond: 80 } },
  { id: "7", name: "Lamine Yamal", country: "🇪🇸", position: "RW", rarity: "legendary", overall: 92, attributes: { confidence: 88, form: 91, morale: 90, fanBond: 93 } },
  { id: "8", name: "Bukayo Saka", country: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", position: "RW", rarity: "rare", overall: 87, attributes: { confidence: 78, form: 82, morale: 80, fanBond: 76 } },
];

export const mockZones: MapZone[] = [
  { id: "z1", type: "training", name: "Training Ground", x: 25, y: 30, benefit: "+Form" },
  { id: "z2", type: "recovery", name: "Recovery Center", x: 65, y: 20, benefit: "+Morale" },
  { id: "z3", type: "fan-arena", name: "Fan Arena", x: 45, y: 55, benefit: "+Fan Bond" },
  { id: "z4", type: "rival", name: "Rival Pitch", x: 75, y: 45, benefit: "Battle" },
  { id: "z5", type: "pressure", name: "Pressure Zone", x: 20, y: 65, benefit: "+Confidence" },
  { id: "z6", type: "stadium", name: "Stadium Zone", x: 55, y: 75, benefit: "Live Bonus" },
];

export const mockMission: Mission = {
  id: "m1",
  title: "Scout 3 Players",
  description: "Discover new talent on the map",
  reward: "⚡ 50 XP + Rare Pack",
  progress: 1,
  total: 3,
};

export const mockRivals: Rival[] = [
  { id: "r1", name: "Alex_FC", level: 12, player: "Haaland", overall: 89 },
  { id: "r2", name: "GoalKing99", level: 15, player: "Salah", overall: 91 },
  { id: "r3", name: "TikiTaka", level: 10, player: "Pedri", overall: 85 },
];

export const mockLiveEvents: LiveEvent[] = [
  { id: "e1", title: "Mbappé scores hat-trick!", description: "Your player gets +5 Form boost", type: "boost", timeAgo: "2m ago" },
  { id: "e2", title: "World Cup Qualifier Live", description: "France vs Germany — tune in for bonuses", type: "match", timeAgo: "15m ago" },
  { id: "e3", title: "Limited: Golden Hour", description: "2x rewards for next 30 minutes", type: "limited", timeAgo: "28m ago" },
  { id: "e4", title: "Daily Reward Ready", description: "Claim your daily cultivation bonus", type: "reward", timeAgo: "1h ago" },
  { id: "e5", title: "Bellingham assists twice", description: "Your player gets +3 Confidence", type: "boost", timeAgo: "2h ago" },
];

export const rarityColors: Record<string, string> = {
  common: "from-zinc-500 to-zinc-600",
  rare: "from-blue-500 to-blue-600",
  epic: "from-purple-500 to-purple-600",
  legendary: "from-amber-400 to-orange-500",
};

export const zoneIcons: Record<string, string> = {
  training: "⚽",
  recovery: "💚",
  "fan-arena": "🏟️",
  rival: "⚔️",
  pressure: "🔥",
  stadium: "🌟",
};

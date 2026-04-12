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
  stats: PlayerStats;
  attributes: {
    confidence: number;
    form: number;
    morale: number;
    fanBond: number;
  };
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

export const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Kylian Mbappé",
    portrait: dicebearPortrait("ppc-player-1-mbappe"),
    age: 26,
    position: "ST",
    clubTeam: "Paris Saint-Germain",
    nationalTeam: "France",
    representedCountry: "France",
    rarity: "legendary",
    traits: ["Clinical Finisher", "Lightning Acceleration", "Big-game instinct"],
    stats: { overall: 95, pace: 97, shooting: 94, passing: 87, dribbling: 93, defending: 38, physical: 78 },
    attributes: { confidence: 92, form: 88, morale: 95, fanBond: 90 },
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
    traits: ["Box-to-box engine", "Late runs", "Composed finisher"],
    stats: { overall: 91, pace: 84, shooting: 88, passing: 89, dribbling: 88, defending: 82, physical: 86 },
    attributes: { confidence: 85, form: 90, morale: 88, fanBond: 82 },
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
    traits: ["Explosive dribbler", "Wide threat", "1v1 specialist"],
    stats: { overall: 93, pace: 95, shooting: 84, passing: 83, dribbling: 95, defending: 29, physical: 74 },
    attributes: { confidence: 90, form: 85, morale: 92, fanBond: 95 },
  },
  {
    id: "4",
    name: "Pedri",
    portrait: dicebearPortrait("ppc-player-4-pedri"),
    age: 22,
    position: "CM",
    clubTeam: "FC Barcelona",
    nationalTeam: "Spain",
    representedCountry: "Spain",
    rarity: "epic",
    traits: ["Tempo controller", "Press-resistant", "Vision"],
    stats: { overall: 89, pace: 76, shooting: 78, passing: 92, dribbling: 90, defending: 72, physical: 68 },
    attributes: { confidence: 80, form: 86, morale: 84, fanBond: 78 },
  },
  {
    id: "5",
    name: "Phil Foden",
    portrait: dicebearPortrait("ppc-player-5-foden"),
    age: 25,
    position: "RW",
    clubTeam: "Manchester City",
    nationalTeam: "England",
    representedCountry: "England",
    rarity: "rare",
    traits: ["Creative playmaker", "Tight-space technician", "Set-piece threat"],
    stats: { overall: 88, pace: 86, shooting: 85, passing: 88, dribbling: 91, defending: 56, physical: 62 },
    attributes: { confidence: 82, form: 84, morale: 80, fanBond: 75 },
  },
  {
    id: "6",
    name: "Florian Wirtz",
    portrait: dicebearPortrait("ppc-player-6-wirtz"),
    age: 22,
    position: "AM",
    clubTeam: "Bayer 04 Leverkusen",
    nationalTeam: "Germany",
    representedCountry: "Germany",
    rarity: "epic",
    traits: ["Playmaker", "Final-third entries", "Pressing IQ"],
    stats: { overall: 90, pace: 84, shooting: 86, passing: 91, dribbling: 92, defending: 48, physical: 66 },
    attributes: { confidence: 86, form: 88, morale: 85, fanBond: 80 },
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
    traits: ["Generational wide talent", "1v1 menace", "Crossing range"],
    stats: { overall: 92, pace: 90, shooting: 84, passing: 86, dribbling: 94, defending: 34, physical: 62 },
    attributes: { confidence: 88, form: 91, morale: 90, fanBond: 93 },
  },
  {
    id: "8",
    name: "Bukayo Saka",
    portrait: dicebearPortrait("ppc-player-8-saka"),
    age: 23,
    position: "RW",
    clubTeam: "Arsenal",
    nationalTeam: "England",
    representedCountry: "England",
    rarity: "rare",
    traits: ["Two-footed wide threat", "Defensive work-rate", "Composure"],
    stats: { overall: 87, pace: 88, shooting: 86, passing: 84, dribbling: 90, defending: 65, physical: 74 },
    attributes: { confidence: 78, form: 82, morale: 80, fanBond: 76 },
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

/** Player encounters clustered near host-corridor metros */
export const mockPlayerMarkers: PlayerMarker[] = [
  { id: "pm-nyc-1", playerId: "1", lat: 40.7484, lng: -73.9857 },
  { id: "pm-la-1", playerId: "3", lat: 34.0522, lng: -118.2437 },
  { id: "pm-mia-1", playerId: "7", lat: 25.7743, lng: -80.1937 },
  { id: "pm-dal-1", playerId: "2", lat: 32.7792, lng: -96.8089 },
  { id: "pm-atl-1", playerId: "4", lat: 33.7537, lng: -84.3963 },
  { id: "pm-sea-1", playerId: "8", lat: 47.6097, lng: -122.3331 },
  { id: "pm-mex-1", playerId: "5", lat: 19.4342, lng: -99.1386 },
  { id: "pm-gdl-1", playerId: "6", lat: 20.672, lng: -103.338 },
  { id: "pm-mty-1", playerId: "1", lat: 25.6866, lng: -100.3161 },
  { id: "pm-tor-1", playerId: "2", lat: 43.6532, lng: -79.3832 },
  { id: "pm-van-1", playerId: "3", lat: 49.2827, lng: -123.1207 },
  { id: "pm-mon-1", playerId: "7", lat: 45.5017, lng: -73.5673 },
  { id: "pm-nyc-2", playerId: "8", lat: 40.7614, lng: -73.9776 },
  { id: "pm-la-2", playerId: "4", lat: 33.985, lng: -118.4695 },
  { id: "pm-mia-2", playerId: "2", lat: 25.7617, lng: -80.1918 },
  { id: "pm-tor-2", playerId: "5", lat: 43.6415, lng: -79.3954 },
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
  { id: "r1", name: "Alex_FC", level: 12, signaturePlayerId: "6" },
  { id: "r2", name: "GoalKing99", level: 15, signaturePlayerId: "3" },
  { id: "r3", name: "TikiTaka", level: 10, signaturePlayerId: "4" },
];

export const mockLiveEvents: LiveEvent[] = [
  { id: "e1", title: "Hat-trick for your active striker!", description: "Your player gets +5 Form boost", type: "boost", timeAgo: "2m ago" },
  { id: "e2", title: "CONCACAF Derby Live", description: "USA vs Mexico in Arlington — tune in for bonuses", type: "match", timeAgo: "15m ago" },
  { id: "e3", title: "Limited: Golden Hour", description: "2x rewards for next 30 minutes", type: "limited", timeAgo: "28m ago" },
  { id: "e4", title: "Daily Reward Ready", description: "Claim your daily cultivation bonus", type: "reward", timeAgo: "1h ago" },
  { id: "e5", title: "Midfield maestro assists twice", description: "Your player gets +3 Confidence", type: "boost", timeAgo: "2h ago" },
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
  mission: "📸",
};

type CatalogPlayer = {
  externalId: string;
  name: string;
  portrait: string;
  age: number;
  position: string;
  representedCountry?: string;
  rarity: "common" | "rare" | "epic" | "legendary";
};

export type LocalTalentEncounter = {
  id: string;
  basePlayerId: string;
  displayName: string;
  portrait: string;
  age: number;
  position: string;
  hometown: string;
  skillStyle: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  scoutingDescription: string;
  lat: number;
  lng: number;
  spawnedAt: string;
  expiresAt: string;
  lifetimeMs: number;
  remainingMs: number;
  distanceKm: number;
  encounterTier: "local" | "prospect" | "known" | "surprise";
  source: "local-talent";
  tags: string[];
};

export const LOCAL_TALENT_DISCOVERY_CONFIG = {
  spawnLifetimeMs: 10_000,
  // Tier weighting: local > prospect > known > surprise
  tierThresholds: {
    local: 0.57,
    prospect: 0.84,
    known: 0.96,
  },
  distanceBands: {
    nearRatio: 0.25,
    midRatio: 0.65,
    nearPopulationRatio: 0.35,
    midPopulationRatio: 0.8,
  },
};

function hashSeed(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function seeded(seed: number, step: number) {
  const x = Math.sin(seed + step * 95.771) * 10000;
  return x - Math.floor(x);
}

const HOMETOWNS = [
  "Neighborhood East",
  "Old Port District",
  "Riverfront Block",
  "Northside Courts",
  "Downtown Arc",
  "Harborline Ward",
  "Metro South",
  "Hillside Quarter",
];

const SKILL_STYLES = [
  "quick first touch",
  "press-resistant dribbler",
  "box poacher instincts",
  "late-run specialist",
  "aggressive recovery tackle",
  "set-piece curve artist",
  "chaotic high press engine",
  "street-football flair",
];

const ALIAS_PREFIX = [
  "Hidden Prospect",
  "UnderRadar",
  "Street Ace",
  "Night League",
  "Academy Unknown",
  "Local Spark",
];

const SURPRISE_PREFIX = ["Flash Sighting", "Star Watch", "Breakout Radar"];

function pick<T>(arr: T[], value: number) {
  return arr[Math.floor(value * arr.length)] ?? arr[0];
}

function approxDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = (a.lng - b.lng) * 111 * Math.cos(((a.lat + b.lat) * 0.5 * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 111;
  return Math.sqrt(dx * dx + dy * dy);
}

function spawnCountByZoom(zoom?: number) {
  if (zoom === undefined) return 18;
  if (zoom <= 6) return 10;
  if (zoom <= 8) return 14;
  if (zoom <= 10) return 20;
  if (zoom <= 12) return 26;
  if (zoom <= 14) return 32;
  return 38;
}

function minSeparationKmByZoom(zoom?: number) {
  if (zoom === undefined) return 0.09;
  if (zoom <= 8) return 0.2;
  if (zoom <= 10) return 0.14;
  if (zoom <= 12) return 0.1;
  if (zoom <= 14) return 0.075;
  return 0.06;
}

function chooseTier(rand: number): LocalTalentEncounter["encounterTier"] {
  if (rand < LOCAL_TALENT_DISCOVERY_CONFIG.tierThresholds.local) return "local";
  if (rand < LOCAL_TALENT_DISCOVERY_CONFIG.tierThresholds.prospect) return "prospect";
  if (rand < LOCAL_TALENT_DISCOVERY_CONFIG.tierThresholds.known) return "known";
  return "surprise";
}

export function buildLocalTalentEncounters(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
  players: CatalogPlayer[];
  zoom?: number;
  limit?: number;
  seedKey?: string;
}) {
  const nowMs = Date.now();
  const radiusKm = params.radiusKm ?? 4.5;
  const desiredLimit = Math.max(8, Math.min(44, params.limit ?? spawnCountByZoom(params.zoom)));
  const minSeparationKm = minSeparationKmByZoom(params.zoom);
  const seed = hashSeed(
    `${params.lat.toFixed(3)}:${params.lng.toFixed(3)}:${radiusKm.toFixed(2)}:${params.zoom ?? "na"}:${params.seedKey ?? "stable"}`
  );

  const localPool = params.players.filter((p) => p.rarity === "common" || p.rarity === "rare");
  const prospectPool = params.players.filter((p) => p.rarity === "rare" || p.rarity === "epic");
  const knownPool = params.players.filter((p) => p.rarity !== "common");
  const surprisePool = params.players.filter((p) => p.rarity === "legendary" || p.rarity === "epic");

  const fallbackPool = params.players;
  if (fallbackPool.length === 0) return [];

  const rows: LocalTalentEncounter[] = [];
  for (let i = 0; i < desiredLimit; i += 1) {
    const tier = chooseTier(seeded(seed, i + 1));
    const sourcePool =
      tier === "local"
        ? localPool
        : tier === "prospect"
          ? prospectPool
          : tier === "known"
            ? knownPool
            : surprisePool;
    const pool = sourcePool.length > 0 ? sourcePool : fallbackPool;
    const base = pool[Math.floor(seeded(seed, i + 11) * pool.length)]!;
    const nearBandEnd = Math.max(0.8, radiusKm * LOCAL_TALENT_DISCOVERY_CONFIG.distanceBands.nearRatio);
    const midBandEnd = Math.max(1.8, radiusKm * LOCAL_TALENT_DISCOVERY_CONFIG.distanceBands.midRatio);

    let distanceKm =
      i < Math.floor(desiredLimit * LOCAL_TALENT_DISCOVERY_CONFIG.distanceBands.nearPopulationRatio)
        ? 0.08 + seeded(seed, i + 15) * nearBandEnd
        : i < Math.floor(desiredLimit * LOCAL_TALENT_DISCOVERY_CONFIG.distanceBands.midPopulationRatio)
          ? nearBandEnd + seeded(seed, i + 19) * (midBandEnd - nearBandEnd)
          : midBandEnd + seeded(seed, i + 21) * Math.max(0.6, radiusKm - midBandEnd);

    distanceKm = Math.max(0.06, Math.min(radiusKm, distanceKm));
    const hometown = base.representedCountry ?? pick(HOMETOWNS, seeded(seed, i + 31));
    const style = pick(SKILL_STYLES, seeded(seed, i + 33));
    const age =
      tier === "known"
        ? Math.max(18, Math.min(33, base.age))
        : Math.max(16, Math.min(24, base.age - 2 + Math.round(seeded(seed, i + 35) * 4)));

    let lat = params.lat;
    let lng = params.lng;
    let accepted = false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const angle = seeded(seed + attempt * 7, i + 40 + attempt) * Math.PI * 2;
      const dLat = (distanceKm / 111) * Math.cos(angle);
      const dLng = (distanceKm / (111 * Math.cos((params.lat * Math.PI) / 180))) * Math.sin(angle);
      const cand = {
        lat: Math.min(85, Math.max(-85, params.lat + dLat)),
        lng: ((params.lng + dLng + 540) % 360) - 180,
      };
      const tooClose = rows.some((r) => approxDistanceKm({ lat: r.lat, lng: r.lng }, cand) < minSeparationKm);
      if (!tooClose || attempt === 23) {
        lat = cand.lat;
        lng = cand.lng;
        accepted = true;
        break;
      }
      distanceKm = Math.min(radiusKm, distanceKm + minSeparationKm * 0.35);
    }
    if (!accepted) continue;

    const rarity =
      tier === "surprise" ? "legendary" : tier === "known" ? (base.rarity === "legendary" ? "epic" : base.rarity) : base.rarity;
    const displayName =
      tier === "known"
        ? base.name
        : tier === "surprise"
          ? `${pick(SURPRISE_PREFIX, seeded(seed, i + 52))}: ${base.name}`
          : `${pick(ALIAS_PREFIX, seeded(seed, i + 50))} #${Math.floor(seeded(seed, i + 53) * 99) + 1}`;

    const tags =
      tier === "local"
        ? ["local", "common"]
        : tier === "prospect"
          ? ["under-radar", "prospect"]
          : tier === "known"
            ? ["known-player", "occasional"]
            : ["surprise", "rare-encounter"];

    rows.push({
      id: `local-${seed}-${i}`,
      basePlayerId: base.externalId,
      displayName,
      portrait: base.portrait,
      age,
      position: base.position,
      hometown,
      skillStyle: style,
      rarity,
      scoutingDescription:
        tier === "known"
          ? `Recognized name spotted nearby, still dangerous in tight spaces.`
          : tier === "surprise"
            ? `Unexpected elite sighting. Short window to challenge this star.`
            : `${hometown} prospect with ${style}.`,
      lat,
      lng,
      spawnedAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + LOCAL_TALENT_DISCOVERY_CONFIG.spawnLifetimeMs).toISOString(),
      lifetimeMs: LOCAL_TALENT_DISCOVERY_CONFIG.spawnLifetimeMs,
      remainingMs: LOCAL_TALENT_DISCOVERY_CONFIG.spawnLifetimeMs,
      distanceKm: Math.round(distanceKm * 10) / 10,
      encounterTier: tier,
      source: "local-talent",
      tags,
    });
  }

  return rows.sort((a, b) => a.distanceKm - b.distanceKm);
}


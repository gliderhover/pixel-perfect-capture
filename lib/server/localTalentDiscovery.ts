type CatalogPlayer = {
  externalId: string;
  portrait: string;
  age: number;
  position: string;
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
  rarity: "common" | "rare" | "epic";
  scoutingDescription: string;
  lat: number;
  lng: number;
  source: "local-talent";
  tags: string[];
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

function pick<T>(arr: T[], value: number) {
  return arr[Math.floor(value * arr.length)] ?? arr[0];
}

export function buildLocalTalentEncounters(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
  players: CatalogPlayer[];
  limit?: number;
}) {
  const radiusKm = params.radiusKm ?? 5;
  const limit = params.limit ?? 4;
  const seed = hashSeed(`${params.lat.toFixed(3)}:${params.lng.toFixed(3)}:${radiusKm.toFixed(2)}`);

  const candidatePlayers = params.players
    .filter((p) => p.rarity === "common" || p.rarity === "rare" || p.rarity === "epic")
    .slice(0, Math.max(limit * 2, 8));

  if (candidatePlayers.length === 0) return [];

  const rows: LocalTalentEncounter[] = [];
  for (let i = 0; i < limit; i += 1) {
    const base = candidatePlayers[Math.floor(seeded(seed, i + 1) * candidatePlayers.length)]!;
    const angle = seeded(seed, i + 4) * Math.PI * 2;
    const distanceKm = 0.4 + seeded(seed, i + 8) * Math.max(0.8, radiusKm - 0.4);
    const dLat = (distanceKm / 111) * Math.cos(angle);
    const dLng = (distanceKm / (111 * Math.cos((params.lat * Math.PI) / 180))) * Math.sin(angle);
    const lat = Math.min(85, Math.max(-85, params.lat + dLat));
    const lng = ((params.lng + dLng + 540) % 360) - 180;
    const alias = pick(ALIAS_PREFIX, seeded(seed, i + 11));
    const style = pick(SKILL_STYLES, seeded(seed, i + 15));
    const hometown = pick(HOMETOWNS, seeded(seed, i + 18));
    const age = Math.max(16, Math.min(24, base.age - 2 + Math.round(seeded(seed, i + 21) * 4)));

    rows.push({
      id: `local-${seed}-${i}`,
      basePlayerId: base.externalId,
      displayName: `${alias} #${Math.floor(seeded(seed, i + 25) * 99) + 1}`,
      portrait: base.portrait,
      age,
      position: base.position,
      hometown,
      skillStyle: style,
      rarity: base.rarity === "legendary" ? "epic" : base.rarity,
      scoutingDescription: `${hometown} prospect with ${style}.`,
      lat,
      lng,
      source: "local-talent",
      tags: ["local", "hidden-prospect"],
    });
  }

  return rows;
}


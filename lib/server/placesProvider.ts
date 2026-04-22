export type NearbyFootballPlaceType = "soccer-field" | "gym" | "soccer-club" | "sports-bar";

export type NearbyFootballPlace = {
  id: string;
  name: string;
  type: NearbyFootballPlaceType;
  lat: number;
  lng: number;
  distanceKm: number;
  mappedZoneType:
    | "training"
    | "rival"
    | "pressure"
    | "stadium"
    | "mission";
  mappedZoneLabel: string;
};

function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num));
}

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function seeded(step: number, seed: number) {
  const x = Math.sin(seed + step * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

function offsetCoord(lat: number, lng: number, dLat: number, dLng: number) {
  return {
    lat: clamp(lat + dLat, -85, 85),
    lng: ((lng + dLng + 540) % 360) - 180,
  };
}

const PLACE_BLUEPRINTS: Array<{
  type: NearbyFootballPlaceType;
  mappedZoneType: NearbyFootballPlace["mappedZoneType"];
  mappedZoneLabel: string;
  names: string[];
}> = [
  {
    type: "soccer-field",
    mappedZoneType: "training",
    mappedZoneLabel: "Training Ground",
    names: ["Community Pitch", "Neighborhood Turf", "Local Five-a-Side", "Riverside Field"],
  },
  {
    type: "gym",
    mappedZoneType: "stadium",
    mappedZoneLabel: "Stadium Zone",
    names: ["Performance Gym", "Athlete Recovery Lab", "Strength Hub", "Core Conditioning Club"],
  },
  {
    type: "soccer-club",
    mappedZoneType: "rival",
    mappedZoneLabel: "Rival Pitch",
    names: ["United Training Club", "District FC Academy", "Metro Football Club", "City Strikers Hub"],
  },
  {
    type: "sports-bar",
    mappedZoneType: "pressure",
    mappedZoneLabel: "Pressure Zone",
    names: ["Matchday Lounge", "Offside Sports Bar", "Final Whistle Bar", "Ultra Fans Tavern"],
  },
];

export async function getNearbyFootballPlaces(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
}) {
  const radiusKm = params.radiusKm ?? 5;
  const seed = hashSeed(`${params.lat.toFixed(3)}:${params.lng.toFixed(3)}:${radiusKm.toFixed(1)}`);
  const rows: NearbyFootballPlace[] = [];

  for (let i = 0; i < PLACE_BLUEPRINTS.length; i += 1) {
    const b = PLACE_BLUEPRINTS[i];
    const angle = seeded(i + 1, seed) * Math.PI * 2;
    const distanceKm = 0.7 + seeded(i + 5, seed) * Math.max(1, radiusKm - 0.7);
    const dLat = (distanceKm / 111) * Math.cos(angle);
    const dLng = (distanceKm / (111 * Math.cos((params.lat * Math.PI) / 180))) * Math.sin(angle);
    const coord = offsetCoord(params.lat, params.lng, dLat, dLng);
    const name = b.names[Math.floor(seeded(i + 9, seed) * b.names.length)] ?? b.names[0];
    rows.push({
      id: `place-${seed}-${i}`,
      name,
      type: b.type,
      lat: coord.lat,
      lng: coord.lng,
      distanceKm: Math.round(distanceKm * 10) / 10,
      mappedZoneType: b.mappedZoneType,
      mappedZoneLabel: b.mappedZoneLabel,
    });
  }

  return rows.sort((a, b) => a.distanceKm - b.distanceKm);
}


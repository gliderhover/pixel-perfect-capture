import type { Player } from "@/data/mockData";

export type ApiPlayer = {
  externalId: string;
  slug: string;
  name: string;
  portrait: string;
  age: number;
  position: string;
  clubTeam: string;
  nationalTeam: string;
  representedCountry: string;
  rarity: Player["rarity"];
  traits: string[];
  stats: {
    confidence: number;
    form: number;
    morale: number;
    fanBond: number;
  };
  level: number;
  xp: number;
  evolutionStage: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiLeaderboardEntry = {
  username: string;
  region: string;
  activePlayerId: string;
  score: number;
  streak: number;
  rankBadge?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiZone = {
  zoneType:
    | "training"
    | "recovery"
    | "fan-arena"
    | "rival"
    | "pressure"
    | "stadium"
    | "mission";
  name: string;
  latitude: number;
  longitude: number;
  region: string;
  rewardType: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiListResponse<T> = {
  data: T[];
  count?: number;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export async function fetchPlayers(filters?: {
  rarity?: string;
  position?: string;
  representedCountry?: string;
}) {
  const search = new URLSearchParams();
  if (filters?.rarity) search.set("rarity", filters.rarity);
  if (filters?.position) search.set("position", filters.position);
  if (filters?.representedCountry) search.set("representedCountry", filters.representedCountry);
  const qs = search.toString();
  const url = qs ? `/api/players?${qs}` : "/api/players";
  return fetchJson<ApiListResponse<ApiPlayer>>(url);
}

export async function fetchPlayerById(idOrSlug: string) {
  return fetchJson<{ data: ApiPlayer }>(`/api/players/${encodeURIComponent(idOrSlug)}`);
}

export async function fetchLeaderboard(scope: "global" | "region", region?: string) {
  const search = new URLSearchParams();
  search.set("scope", scope);
  if (region) search.set("region", region);
  return fetchJson<ApiListResponse<ApiLeaderboardEntry>>(`/api/leaderboard?${search.toString()}`);
}

export async function fetchZones(region?: string) {
  const search = new URLSearchParams();
  if (region) search.set("region", region);
  const qs = search.toString();
  const url = qs ? `/api/zones?${qs}` : "/api/zones";
  return fetchJson<ApiListResponse<ApiZone>>(url);
}

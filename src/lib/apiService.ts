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

export type ApiLiveEvent = {
  id: string;
  title: string;
  description: string;
  type: "boost" | "match" | "reward" | "limited";
  timeAgo: string;
};

export type ApiLocalTalentEncounter = {
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

export type ApiNearbyPlace = {
  id: string;
  name: string;
  type: "soccer-field" | "gym" | "soccer-club" | "sports-bar";
  lat: number;
  lng: number;
  distanceKm: number;
  mappedZoneType:
    | "training"
    | "recovery"
    | "fan-arena"
    | "rival"
    | "pressure"
    | "stadium"
    | "mission";
  mappedZoneLabel: string;
};

export type ApiUserPlayer = {
  userId: string;
  playerId: string;
  level: number;
  xp: number;
  evolutionStage: number;
  stats: {
    confidence: number;
    form: number;
    morale: number;
    fanBond: number;
  };
  shards: number;
  recruitedAt: string;
  lastTrainedAt: string | null;
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

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string" ? payload.error : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
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

export async function fetchUserPlayers(userId: string) {
  const search = new URLSearchParams();
  search.set("userId", userId);
  return fetchJson<ApiListResponse<ApiUserPlayer> & { userId: string }>(
    `/api/user-players?${search.toString()}`
  );
}

export async function recruitUserPlayer(userId: string, playerId: string) {
  return postJson<{
    ok: boolean;
    recruited: boolean;
    message?: string;
    data: ApiUserPlayer;
  }>("/api/user-players/recruit", { userId, playerId });
}

export async function trainUserPlayer(
  userId: string,
  playerId: string,
  mode: "balanced" | "confidence" | "form" | "morale" | "bond" = "balanced"
) {
  return postJson<{
    ok: boolean;
    mode: string;
    xpGained: number;
    delta: Partial<ApiUserPlayer["stats"]>;
    data: ApiUserPlayer | null;
  }>("/api/user-players/train", { userId, playerId, mode });
}

export async function submitChallengeResult(input: {
  userId: string;
  playerId: string;
  result: "win" | "loss" | "draw";
  opponentPower: number;
  region?: string;
  opponentUserId?: string;
}) {
  return postJson<{
    ok: boolean;
    challenge: Record<string, unknown>;
    userPlayer: ApiUserPlayer | null;
  }>("/api/challenges/result", input);
}

export async function recalculateLeaderboard(scope: "global" | "region", region?: string, userId?: string) {
  return postJson<{
    ok: boolean;
    updated: number;
    scope: "global" | "region";
    region: string | null;
  }>("/api/leaderboard/recalculate", { scope, region, userId });
}

export async function rewardCameraScan(input: {
  userId: string;
  playerId: string;
  zoneType?: ApiZone["zoneType"];
  missionId?: string;
}) {
  return postJson<{
    ok: boolean;
    reward: Record<string, unknown>;
    userPlayer: ApiUserPlayer | null;
  }>("/api/camera-scans/reward", input);
}

export async function fetchLiveEvents() {
  return fetchJson<ApiListResponse<ApiLiveEvent> & { source: string }>("/api/live-events");
}

export async function sendPlayerChat(input: {
  playerId: string;
  message: string;
  state?: {
    confidence: number;
    form: number;
    morale: number;
    fanBond: number;
  };
  history?: { role: "user" | "assistant"; content: string }[];
  context?: {
    zoneType?: string;
    matchPhase?: string;
    livePulse?: string;
    competitiveStreak?: number;
    liveEventTitle?: string;
  };
}) {
  return postJson<{
    reply: string;
    attributeDeltas: {
      confidence: number;
      form: number;
      morale: number;
      fanBond: number;
    };
    tags?: string[];
    meta: { model: string };
  }>("/api/chat", input);
}

export async function fetchDuelLine(input: {
  playerName: string;
  playerPosition: string;
  rarity?: "common" | "rare" | "epic" | "legendary";
  result?: "save" | "goal";
}) {
  return postJson<{ line: string; tags?: string[]; source: string }>("/api/duel-line", input);
}

export async function fetchZoneFlavor(zoneType: string, zoneName: string, liveEventTitle?: string) {
  const search = new URLSearchParams({ zoneType, zoneName });
  if (liveEventTitle) search.set("liveEventTitle", liveEventTitle);
  return fetchJson<{ flavor: string; tags?: string[]; source: string }>(`/api/zone-flavor?${search.toString()}`);
}

export async function fetchLiveDialogue(params?: { title?: string; description?: string; playerName?: string }) {
  const search = new URLSearchParams();
  if (params?.title) search.set("title", params.title);
  if (params?.description) search.set("description", params.description);
  if (params?.playerName) search.set("playerName", params.playerName);
  const qs = search.toString();
  return fetchJson<{ line: string; tags?: string[]; source: string }>(
    qs ? `/api/live-dialogue?${qs}` : "/api/live-dialogue"
  );
}

export async function fetchNearbyLocalTalents(
  lat: number,
  lng: number,
  options?: { radiusKm?: number; zoom?: number; limit?: number; seedKey?: string }
) {
  const search = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(options?.radiusKm ?? 5),
  });
  if (options?.zoom !== undefined) search.set("zoom", String(options.zoom));
  if (options?.limit !== undefined) search.set("limit", String(options.limit));
  if (options?.seedKey) search.set("seedKey", options.seedKey);
  return fetchJson<ApiListResponse<ApiLocalTalentEncounter> & { source: string; note?: string }>(
    `/api/discovery/players-nearby?${search.toString()}`
  );
}

export async function fetchNearbyFootballPlaces(lat: number, lng: number, radiusKm = 5) {
  const search = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(radiusKm),
  });
  return fetchJson<ApiListResponse<ApiNearbyPlace> & { source: string }>(
    `/api/discovery/places-nearby?${search.toString()}`
  );
}

export async function applyCultivation(input: {
  userId: string;
  playerId: string;
  attributeDeltas: {
    confidence: number;
    form: number;
    morale: number;
    fanBond: number;
  };
  xpGain?: number;
}) {
  return postJson<{
    ok: boolean;
    xpGained: number;
    attributeDeltas: {
      confidence: number;
      form: number;
      morale: number;
      fanBond: number;
    };
    data: ApiUserPlayer | null;
  }>("/api/cultivation/apply", input);
}

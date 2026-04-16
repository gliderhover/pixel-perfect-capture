import type { Collection, Db, ObjectId } from "mongodb";

export type PlayerDoc = {
  _id?: ObjectId;
  externalId: string;
  slug: string;
  name: string;
  portrait: string;
  age: number;
  position: string;
  clubTeam: string;
  nationalTeam: string;
  representedCountry: string;
  rarity: "common" | "rare" | "epic" | "legendary";
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
  createdAt: Date;
  updatedAt: Date;
};

export type LeaderboardEntryDoc = {
  _id?: ObjectId;
  username: string;
  region: string;
  activePlayerId: string;
  score: number;
  streak: number;
  rankBadge?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ZoneDoc = {
  _id?: ObjectId;
  zoneType: "training" | "recovery" | "fan-arena" | "rival" | "pressure" | "stadium" | "mission";
  name: string;
  latitude: number;
  longitude: number;
  region: string;
  rewardType: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserPlayerDoc = {
  _id?: ObjectId;
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
  recruitedAt: Date;
  lastTrainedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CameraScanRewardDoc = {
  _id?: ObjectId;
  userId: string;
  playerId: string;
  zoneType?: ZoneDoc["zoneType"];
  missionId?: string;
  reward: {
    xp: number;
    shards: number;
    statBoost: {
      confidence: number;
      form: number;
      morale: number;
      fanBond: number;
    };
  };
  scanContext: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ChallengeResultDoc = {
  _id?: ObjectId;
  userId: string;
  playerId: string;
  opponentUserId?: string;
  opponentPower: number;
  result: "win" | "loss" | "draw";
  scoreDelta: number;
  rewards: {
    xp: number;
    shards: number;
  };
  region: string;
  createdAt: Date;
  updatedAt: Date;
};

const globalDbState = globalThis as typeof globalThis & {
  __mongoIndexesReady?: Set<string>;
};

function getReadySet() {
  if (!globalDbState.__mongoIndexesReady) {
    globalDbState.__mongoIndexesReady = new Set<string>();
  }
  return globalDbState.__mongoIndexesReady;
}

async function ensureOnce(key: string, task: () => Promise<void>) {
  const ready = getReadySet();
  if (ready.has(key)) return;
  await task();
  ready.add(key);
}

export async function getPlayerCollection(db: Db): Promise<Collection<PlayerDoc>> {
  await ensureOnce("idx-players-v1", async () => {
    const c = db.collection<PlayerDoc>("players");
    await c.createIndex({ externalId: 1 }, { unique: true });
    await c.createIndex({ slug: 1 }, { unique: true });
    await c.createIndex({ rarity: 1, level: -1 });
    await c.createIndex({ representedCountry: 1, position: 1 });
    await c.createIndex({ updatedAt: -1 });
  });
  return db.collection<PlayerDoc>("players");
}

export async function getLeaderboardCollection(
  db: Db
): Promise<Collection<LeaderboardEntryDoc>> {
  await ensureOnce("idx-leaderboard-v1", async () => {
    const c = db.collection<LeaderboardEntryDoc>("leaderboard_entries");
    await c.createIndex({ username: 1, region: 1 });
    await c.createIndex({ region: 1, score: -1 });
    await c.createIndex({ score: -1, streak: -1 });
    await c.createIndex({ updatedAt: -1 });
  });
  return db.collection<LeaderboardEntryDoc>("leaderboard_entries");
}

export async function getZoneCollection(db: Db): Promise<Collection<ZoneDoc>> {
  await ensureOnce("idx-zones-v1", async () => {
    const c = db.collection<ZoneDoc>("zones");
    await c.createIndex({ zoneType: 1, active: 1 });
    await c.createIndex({ region: 1, active: 1 });
    await c.createIndex({ latitude: 1, longitude: 1 });
    await c.createIndex({ updatedAt: -1 });
  });
  return db.collection<ZoneDoc>("zones");
}

export async function getUserPlayerCollection(db: Db): Promise<Collection<UserPlayerDoc>> {
  await ensureOnce("idx-user-players-v1", async () => {
    const c = db.collection<UserPlayerDoc>("user_players");
    await c.createIndex({ userId: 1, playerId: 1 }, { unique: true });
    await c.createIndex({ userId: 1, updatedAt: -1 });
    await c.createIndex({ userId: 1, level: -1 });
    await c.createIndex({ playerId: 1 });
  });
  return db.collection<UserPlayerDoc>("user_players");
}

export async function getCameraScanRewardCollection(
  db: Db
): Promise<Collection<CameraScanRewardDoc>> {
  await ensureOnce("idx-camera-scan-rewards-v1", async () => {
    const c = db.collection<CameraScanRewardDoc>("camera_scan_rewards");
    await c.createIndex({ userId: 1, createdAt: -1 });
    await c.createIndex({ playerId: 1, createdAt: -1 });
    await c.createIndex({ missionId: 1 });
  });
  return db.collection<CameraScanRewardDoc>("camera_scan_rewards");
}

export async function getChallengeResultCollection(
  db: Db
): Promise<Collection<ChallengeResultDoc>> {
  await ensureOnce("idx-challenge-results-v1", async () => {
    const c = db.collection<ChallengeResultDoc>("challenge_results");
    await c.createIndex({ userId: 1, createdAt: -1 });
    await c.createIndex({ playerId: 1, createdAt: -1 });
    await c.createIndex({ region: 1, createdAt: -1 });
  });
  return db.collection<ChallengeResultDoc>("challenge_results");
}

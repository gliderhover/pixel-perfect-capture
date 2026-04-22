export type PlayerDoc = {
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
  createdAt: string;
  updatedAt: string;
};

export type LeaderboardEntryDoc = {
  username: string;
  region: string;
  activePlayerId: string;
  score: number;
  streak: number;
  rankBadge?: string;
  createdAt: string;
  updatedAt: string;
};

export type ZoneDoc = {
  zoneType: "training" | "rival" | "pressure" | "stadium" | "mission";
  name: string;
  latitude: number;
  longitude: number;
  region: string;
  rewardType: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserPlayerDoc = {
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

export type CameraScanRewardDoc = {
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
  createdAt: string;
  updatedAt: string;
};

export type ChallengeResultDoc = {
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
  createdAt: string;
  updatedAt: string;
};

export const DB_TABLES = {
  players: process.env.SUPABASE_TABLE_PLAYERS ?? "players",
  leaderboard: process.env.SUPABASE_TABLE_LEADERBOARD ?? "leaderboard_entries",
  zones: process.env.SUPABASE_TABLE_ZONES ?? "zones",
  userPlayers: process.env.SUPABASE_TABLE_USER_PLAYERS ?? "user_players",
  cameraScanRewards: process.env.SUPABASE_TABLE_CAMERA_SCAN_REWARDS ?? "camera_scan_rewards",
  challengeResults: process.env.SUPABASE_TABLE_CHALLENGE_RESULTS ?? "challenge_results",
} as const;

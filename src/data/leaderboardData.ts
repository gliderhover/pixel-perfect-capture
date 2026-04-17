import { dicebearPortrait, getPlayerById } from "./mockData.js";

export type LeaderboardScope = "global" | "region";
export type LeaderboardPeriod = "weekly" | "all";

export interface LeaderboardEntry {
  rank: number;
  userName: string;
  playerId: string;
  teamPower: number;
  region: string;
  streak: number;
  coachLevel: number;
  isYou?: boolean;
}

const regions = ["CONCACAF · NA", "UEFA · West", "Americas"];

function row(
  rank: number,
  userName: string,
  playerId: string,
  teamPower: number,
  region: string,
  streak: number,
  coachLevel: number,
  isYou?: boolean
): LeaderboardEntry {
  return { rank, userName, playerId, teamPower, region, streak, coachLevel, isYou };
}

/** Mock global board — portraits resolve from `mockPlayers` via playerId. */
export const mockLeaderboardGlobal: LeaderboardEntry[] = [
  row(1, "Marco_Vitale", "3", 4289, regions[0], 12, 42),
  row(2, "JaviHerrera", "1", 4156, regions[0], 9, 38),
  row(3, "LuisFuentes", "7", 4021, regions[0], 8, 36),
  row(4, "KwameNkosi", "2", 3890, regions[0], 6, 34),
  row(5, "TylerMoore", "8", 3755, regions[0], 5, 33),
  row(6, "CarlosRuiz", "4", 3620, regions[0], 4, 31),
  row(7, "IsaacMendez", "5", 3512, regions[0], 3, 29),
  row(8, "OliverChang", "6", 3401, regions[0], 2, 28),
];

export const mockLeaderboardRegion: LeaderboardEntry[] = [
  row(1, "Marco_Vitale", "3", 4289, regions[0], 12, 42),
  row(2, "JaviHerrera", "1", 4156, regions[0], 9, 38),
  row(3, "LuisFuentes", "7", 4021, regions[0], 8, 36),
  row(4, "KwameNkosi", "2", 3890, regions[0], 6, 34),
  row(5, "You", "1", 2842, regions[0], 3, 18, true),
  row(6, "CarlosRuiz", "4", 2620, regions[0], 4, 31),
  row(7, "IsaacMendez", "5", 2512, regions[0], 3, 29),
];

export function portraitForEntry(playerId: string): string {
  return getPlayerById(playerId)?.portrait ?? dicebearPortrait(`lb-${playerId}`);
}

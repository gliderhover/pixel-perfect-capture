drop table if exists public.challenge_results cascade;
drop table if exists public.camera_scan_rewards cascade;
drop table if exists public.user_players cascade;
drop table if exists public.zones cascade;
drop table if exists public.leaderboard_entries cascade;
drop table if exists public.players cascade;

create table public.players (
  "externalId" text primary key,
  "slug" text unique not null,
  "name" text not null,
  "portrait" text not null,
  "age" integer not null,
  "position" text not null,
  "clubTeam" text not null,
  "nationalTeam" text not null,
  "representedCountry" text not null,
  "rarity" text not null check ("rarity" in ('common', 'rare', 'epic', 'legendary')),
  "traits" text[] not null default '{}',
  "stats" jsonb not null,
  "level" integer not null default 1,
  "xp" integer not null default 0,
  "evolutionStage" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table public.leaderboard_entries (
  "username" text not null,
  "region" text not null,
  "activePlayerId" text not null,
  "score" integer not null default 0,
  "streak" integer not null default 0,
  "rankBadge" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  primary key ("username", "region")
);

create table public.zones (
  "name" text primary key,
  "zoneType" text not null check ("zoneType" in ('training', 'recovery', 'fan-arena', 'rival', 'pressure', 'stadium', 'mission')),
  "latitude" double precision not null,
  "longitude" double precision not null,
  "region" text not null,
  "rewardType" text not null,
  "active" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table public.user_players (
  "userId" text not null,
  "playerId" text not null,
  "level" integer not null default 1,
  "xp" integer not null default 0,
  "evolutionStage" integer not null default 0,
  "stats" jsonb not null,
  "shards" integer not null default 0,
  "recruitedAt" timestamptz not null default now(),
  "lastTrainedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  primary key ("userId", "playerId")
);

create table public.camera_scan_rewards (
  "id" bigint generated always as identity primary key,
  "userId" text not null,
  "playerId" text not null,
  "zoneType" text,
  "missionId" text,
  "reward" jsonb not null,
  "scanContext" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table public.challenge_results (
  "id" bigint generated always as identity primary key,
  "userId" text not null,
  "playerId" text not null,
  "opponentUserId" text,
  "opponentPower" integer not null default 0,
  "result" text not null check ("result" in ('win', 'loss', 'draw')),
  "scoreDelta" integer not null default 0,
  "rewards" jsonb not null,
  "region" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index idx_players_updated on public.players ("updatedAt" desc);
create index idx_players_country_position on public.players ("representedCountry", "position");
create index idx_zones_region_active on public.zones ("region", "active");
create index idx_user_players_user_updated on public.user_players ("userId", "updatedAt" desc);
create index idx_leaderboard_region_score on public.leaderboard_entries ("region", "score" desc, "streak" desc);
create index idx_challenge_results_user_created on public.challenge_results ("userId", "createdAt" desc);
create index idx_camera_scan_rewards_user_created on public.camera_scan_rewards ("userId", "createdAt" desc);

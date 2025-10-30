export type GameMode = 'full_season' | 'short_gt' | 'short_wt' | 'short_classics';
export type LeagueStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type AuctionStrategy = 'single' | 'per_phase' | 'grouped';

export type CourseFilters = {
  wt_tier?: string[];
  categorie?: string[];
  competitions?: string[];
  exclude_proseries?: boolean;
};

export type League = {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  owner_manager_id: string;
  settings: Record<string, any>;
  created_at: string;
  max_players: number;
  current_player_count: number;
  game_mode: GameMode;
  bonuses_enabled: boolean;
  status: LeagueStatus;
  started_at: string | null;
  archived_at: string | null;
};

export type LeagueMember = {
  id: string;
  league_id: string;
  user_id: string;
  role_in_league: 'owner' | 'admin' | 'member';
  joined_at: string;
};

export type LeagueScope = {
  id: string;
  league_id: string;
  season_id: string | null;
  by_phase: boolean;
  gt_only: boolean;
  wt_only: boolean;
  phases: string[];
  competitions: string[];
  course_filters?: CourseFilters;
};

export type LeagueWithRole = League & {
  role: 'owner' | 'admin' | 'member';
};

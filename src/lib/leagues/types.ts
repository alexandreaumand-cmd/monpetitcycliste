export type League = {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  owner_manager_id: string;
  settings: Record<string, any>;
  created_at: string;
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
  phases: string[];
  competitions: string[];
};

export type LeagueWithRole = League & {
  role: 'owner' | 'admin' | 'member';
};

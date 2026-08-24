import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminOwnedLeague = {
  id: string;
  name: string;
  game_mode: string;
  status: string;
  max_players: number;
  bonuses_enabled: boolean;
  created_at: string;
  memberCount: number;
  seasonYear: number | null;
};

/**
 * Leagues where the current user is owner or admin — any status, any season.
 * Used as source candidates when creating a league from an existing one.
 */
export function useAdminOwnedLeagues(enabled = true) {
  return useQuery({
    queryKey: ['admin-owned-leagues'],
    enabled,
    queryFn: async (): Promise<AdminOwnedLeague[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: memberships, error } = await supabase
        .from('league_members')
        .select(`
          league_id,
          role_in_league,
          leagues:league_id (
            id, name, game_mode, status, max_players, bonuses_enabled, created_at
          )
        `)
        .eq('user_id', user.id)
        .in('role_in_league', ['owner', 'admin']);

      if (error) throw error;

      const leagues = (memberships || [])
        .map((m: any) => m.leagues)
        .filter(Boolean) as Array<Omit<AdminOwnedLeague, 'memberCount' | 'seasonYear'>>;

      if (leagues.length === 0) return [];

      const leagueIds = leagues.map(l => l.id);

      const [{ data: members }, { data: scopes }] = await Promise.all([
        supabase.from('league_members').select('league_id').in('league_id', leagueIds),
        supabase.from('league_scopes').select('league_id, season_id').in('league_id', leagueIds),
      ]);

      const seasonIds = [...new Set((scopes || []).map(s => s.season_id).filter(Boolean))] as string[];
      const { data: seasons } = seasonIds.length
        ? await supabase.from('saisons').select('id, annee').in('id', seasonIds)
        : { data: [] as Array<{ id: string; annee: number }> };

      const yearById = new Map((seasons || []).map(s => [s.id, s.annee]));
      const seasonByLeague = new Map((scopes || []).map(s => [s.league_id, yearById.get(s.season_id!) ?? null]));

      const counts = new Map<string, number>();
      (members || []).forEach(m => counts.set(m.league_id, (counts.get(m.league_id) || 0) + 1));

      return leagues
        .map(l => ({
          ...l,
          memberCount: counts.get(l.id) || 0,
          seasonYear: seasonByLeague.get(l.id) ?? null,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    staleTime: 1000 * 60,
  });
}

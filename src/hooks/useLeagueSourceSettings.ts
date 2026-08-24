import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SourceMember = {
  userId: string;
  managerId: string | null;
  name: string;
  avatarUrl: string | null;
  role: string;
};

export type LeagueSourceSettings = {
  id: string;
  name: string;
  gameMode: string;
  maxPlayers: number;
  visibility: 'public' | 'private';
  bonusesEnabled: boolean;
  seasonId: string | null;
  seasonYear: number | null;
  wtOnly: boolean;
  startingPhaseIndex: number | null;
  courseNames: string[];
  members: SourceMember[];
};

/** Full settings + roster of a league used as a template for a new league. */
export function useLeagueSourceSettings(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-source-settings', leagueId],
    enabled: !!leagueId,
    queryFn: async (): Promise<LeagueSourceSettings | null> => {
      if (!leagueId) return null;

      const [{ data: league, error: leagueError }, { data: scope }, { data: members }] = await Promise.all([
        supabase
          .from('leagues')
          .select('id, name, game_mode, max_players, visibility, bonuses_enabled, starting_phase_index')
          .eq('id', leagueId)
          .single(),
        supabase
          .from('league_scopes')
          .select('season_id, wt_only, selected_course_ids')
          .eq('league_id', leagueId)
          .maybeSingle(),
        supabase
          .from('league_members')
          .select('user_id, role_in_league, joined_at')
          .eq('league_id', leagueId)
          .order('joined_at', { ascending: true }),
      ]);

      if (leagueError) throw leagueError;

      const userIds = (members || []).map(m => m.user_id).filter(Boolean) as string[];
      const [{ data: managers }, { data: season }, { data: courses }] = await Promise.all([
        userIds.length
          ? supabase.from('managers').select('id, user_id, nom, avatar_url').in('user_id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        scope?.season_id
          ? supabase.from('saisons').select('id, annee').eq('id', scope.season_id).maybeSingle()
          : Promise.resolve({ data: null as any }),
        scope?.selected_course_ids?.length
          ? supabase.from('courses').select('id, nom').in('id', scope.selected_course_ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const managerByUser = new Map((managers || []).map((m: any) => [m.user_id, m]));

      return {
        id: league.id,
        name: league.name,
        gameMode: league.game_mode,
        maxPlayers: league.max_players,
        visibility: league.visibility as 'public' | 'private',
        bonusesEnabled: league.bonuses_enabled,
        seasonId: scope?.season_id ?? null,
        seasonYear: season?.annee ?? null,
        wtOnly: scope?.wt_only ?? false,
        startingPhaseIndex: league.starting_phase_index ?? null,
        courseNames: (courses || []).map((c: any) => c.nom).filter(Boolean),
        members: (members || []).map((m: any) => {
          const mgr = managerByUser.get(m.user_id);
          return {
            userId: m.user_id,
            managerId: mgr?.id ?? null,
            name: mgr?.nom ?? 'Inconnu',
            avatarUrl: mgr?.avatar_url ?? null,
            role: m.role_in_league,
          };
        }),
      };
    },
  });
}

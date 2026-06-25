import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GlobalRostersFilters {
  saisonId?: string | null;
  leagueIds?: string[] | null;
  phaseIds?: string[] | null;
  gameModes?: string[] | null;
  coureurSearch?: string | null;
  managerSearch?: string | null;
  page?: number;
  pageSize?: number;
}

export interface GlobalRosterRow {
  roster_id: string;
  coureur_id: string;
  coureur_nom: string;
  equipe_nom: string | null;
  cote: number | null;
  manager_id: string;
  manager_nom: string;
  league_id: string;
  league_name: string;
  game_mode: string;
  phase_id: string;
  phase_index: number;
  saison_id: string;
  saison_annee: number;
  prix_signature: number | null;
  round_achat: number | null;
  total_count: number;
}

export function useGlobalRosters(filters: GlobalRostersFilters) {
  const pageSize = filters.pageSize ?? 100;
  const page = filters.page ?? 0;

  return useQuery({
    queryKey: ["global-rosters", filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_global_rosters", {
        _saison_id: filters.saisonId ?? null,
        _league_ids: filters.leagueIds?.length ? filters.leagueIds : null,
        _phase_ids: filters.phaseIds?.length ? filters.phaseIds : null,
        _game_modes: filters.gameModes?.length ? filters.gameModes : null,
        _coureur_search: filters.coureurSearch?.trim() || null,
        _manager_search: filters.managerSearch?.trim() || null,
        _limit: pageSize,
        _offset: page * pageSize,
      });
      if (error) throw error;
      const rows = (data ?? []) as GlobalRosterRow[];
      return {
        rows,
        totalCount: rows[0]?.total_count ?? 0,
      };
    },
    staleTime: 30_000,
  });
}

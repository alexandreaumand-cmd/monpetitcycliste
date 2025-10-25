import { useQuery } from "@tanstack/react-query";
import { useLeague } from "@/contexts/LeagueContext";
import { supabase } from "@/integrations/supabase/client";

interface Season {
  id: string;
  annee: number;
}

interface LeagueSeasonData {
  seasonId: string;
  season: Season;
  phases: Array<{
    id: string;
    index_dans_saison: number;
    saison_id: string;
    statut: string;
    date_debut: string;
    date_fin: string;
  }>;
  activePhase: {
    id: string;
    index_dans_saison: number;
    saison_id: string;
    statut: string;
    date_debut: string;
    date_fin: string;
  } | null;
}

/**
 * Hook pour récupérer la saison associée à la ligue active
 * La saison est dérivée de la ligue via league_scopes.season_id
 */
export function useLeagueSeason() {
  const { leagueId, isLoading: leagueLoading } = useLeague();

  const query = useQuery({
    queryKey: ["league-season", leagueId],
    enabled: !!leagueId && !leagueLoading,
    queryFn: async (): Promise<LeagueSeasonData> => {
      if (!leagueId) throw new Error("No league ID");

      // 1. Get season from league_scopes
      const { data: scopeData, error: scopeError } = await supabase
        .from("league_scopes")
        .select("season_id, saisons!league_scopes_season_id_fkey(id, annee)")
        .eq("league_id", leagueId)
        .single();

      if (scopeError) throw scopeError;
      if (!scopeData?.season_id) throw new Error("No season found for league");

      const seasonData = scopeData.saisons as unknown as Season;
      const season: Season = {
        id: seasonData.id,
        annee: seasonData.annee,
      };

      // 2. Load phases for this season
      const { data: phasesData, error: phasesError } = await supabase
        .from("phases")
        .select("*")
        .eq("saison_id", season.id)
        .order("index_dans_saison", { ascending: true });

      if (phasesError) throw phasesError;

      // 3. Find active phase
      const activePhase = phasesData?.find(p => p.statut === "active") || 
                         (phasesData && phasesData.length > 0 ? phasesData[phasesData.length - 1] : null);

      return {
        seasonId: season.id,
        season,
        phases: phasesData || [],
        activePhase,
      };
    },
    staleTime: 60_000, // 1 minute
  });

  return {
    seasonId: query.data?.seasonId ?? null,
    season: query.data?.season ?? null,
    seasons: query.data?.season ? [query.data.season] : [], // Pour compatibilité
    phases: query.data?.phases ?? [],
    activePhase: query.data?.activePhase ?? null,
    isLoading: leagueLoading || query.isLoading,
    error: query.error,
  };
}

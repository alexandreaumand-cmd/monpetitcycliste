import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLeagueStats(leagueId: string | null) {
  return useQuery({
    queryKey: ['league-stats', leagueId],
    queryFn: async () => {
      if (!leagueId) return null;
      
      // 1. Récupérer la saison de la ligue
      const { data: scope } = await supabase
        .from('league_scopes')
        .select('season_id, by_phase, phases')
        .eq('league_id', leagueId)
        .maybeSingle();
      
      if (!scope) return null;
      
      // Déterminer la phase active si applicable
      let activePhaseId: string | null = null;
      if (scope.by_phase && scope.phases && Array.isArray(scope.phases) && scope.phases.length > 0) {
        // Récupérer la phase active
        const { data: activePhase } = await supabase
          .from('phases')
          .select('id')
          .eq('saison_id', scope.season_id)
          .eq('statut', 'active')
          .maybeSingle();
        
        activePhaseId = activePhase?.id ?? null;
      }
      
      // 2. Récupérer le manager actuel
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!manager) return null;
      
      // 3. Récupérer les standings par saison
      const { data: seasonStandings } = await supabase
        .from('v_manager_standings_by_season_v2')
        .select('*, managers!inner(nom)')
        .eq('league_id', leagueId)
        .eq('saison_id', scope.season_id)
        .order('total_points', { ascending: false });
      
      // 4. Récupérer les standings par phase si disponible
      let myPhaseRank = null;
      let myPhasePoints = null;
      
      if (activePhaseId) {
        const { data: phaseStandings } = await supabase
          .from('v_manager_standings_by_phase_v2')
          .select('*')
          .eq('league_id', leagueId)
          .eq('phase_id', activePhaseId)
          .order('total_points', { ascending: false });
        
        if (phaseStandings) {
          const myIndex = phaseStandings.findIndex(s => s.manager_id === manager.id);
          if (myIndex >= 0) {
            myPhaseRank = myIndex + 1;
            myPhasePoints = phaseStandings[myIndex].total_points;
          }
        }
      }
      
      // 5. Construire la réponse
      let mySeasonRank = null;
      let mySeasonPoints = null;
      let seasonLeader = null;
      
      if (seasonStandings) {
        const myIndex = seasonStandings.findIndex(s => s.manager_id === manager.id);
        if (myIndex >= 0) {
          mySeasonRank = myIndex + 1;
          mySeasonPoints = seasonStandings[myIndex].total_points;
        }
        if (seasonStandings.length > 0 && seasonStandings[0].managers) {
          seasonLeader = {
            name: (seasonStandings[0].managers as any).nom,
            points: seasonStandings[0].total_points,
          };
        }
      }
      
      return {
        mySeasonRank,
        mySeasonPoints,
        myPhaseRank,
        myPhasePoints,
        seasonLeader,
      };
    },
    enabled: !!leagueId,
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Phase {
  id: string;
  date_debut: string;
  date_fin: string;
  index_dans_saison: number;
}

export function useActivePhase(leagueId: string | null) {
  return useQuery({
    queryKey: ['active-phase', leagueId],
    queryFn: async (): Promise<Phase | null> => {
      if (!leagueId) return null;

      // 1. Récupérer la saison de la ligue via league_scopes
      const { data: scopeData } = await supabase
        .from('league_scopes')
        .select('season_id')
        .eq('league_id', leagueId)
        .single();

      if (!scopeData?.season_id) return null;

      // 2. Charger toutes les phases de cette saison, triées par index
      const { data: phases } = await supabase
        .from('phases')
        .select('id, date_debut, date_fin, index_dans_saison')
        .eq('saison_id', scopeData.season_id)
        .order('index_dans_saison', { ascending: true });

      if (!phases || phases.length === 0) return null;

      // 3. Déterminer la phase active selon le calendrier
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Phase en cours (today entre date_debut et date_fin)
      const currentPhase = phases.find(p => 
        p.date_debut <= today && today <= p.date_fin
      );

      if (currentPhase) return currentPhase;

      // Sinon, prochaine phase à venir
      const nextPhase = phases.find(p => p.date_debut > today);

      if (nextPhase) return nextPhase;

      // Sinon, dernière phase (saison terminée)
      return phases[phases.length - 1];
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000, // 5 minutes - les phases ne changent pas souvent
  });
}

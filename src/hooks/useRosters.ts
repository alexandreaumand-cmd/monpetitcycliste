import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";

export function useRosters() {
  const { leagueId } = useLeague();

  return {
    getByManagerPhase: async (managerId: string, phaseId: string) => {
      if (!leagueId) {
        throw new Error('leagueId requis pour accéder aux rosters');
      }

      const { data, error } = await supabase
        .from("rosters")
        .select("*")
        .eq("manager_id", managerId)
        .eq("phase_id", phaseId)
        .eq("league_id", leagueId);
      
      if (error) throw error;
      return data ?? [];
    },
    
    addRiders: async (
      managerId: string, 
      phaseId: string, 
      riders: Array<{ coureur_id: string; prix_signature: number }>
    ) => {
      const { data, error } = await supabase
        .from("rosters")
        .insert(
          riders.map(r => ({
            manager_id: managerId,
            phase_id: phaseId,
            coureur_id: r.coureur_id,
            prix_signature: r.prix_signature,
            league_id: leagueId
          }))
        )
        .select("*");
      
      if (error) throw error;
      return data;
    }
  };
}

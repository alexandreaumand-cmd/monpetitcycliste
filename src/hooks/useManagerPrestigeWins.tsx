import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ManagerPrestige = {
  hasTourDeFrance: boolean;
  hasGiro: boolean;
  hasVuelta: boolean;
  monuments: string[];
  worldChampionships: {
    hasRR: boolean;
    hasITT: boolean;
    names: string[];
  };
};

export const useManagerPrestigeWins = (phaseId?: string | null, saisonId?: string | null) => {
  return useQuery({
    queryKey: ["manager-prestige-wins", phaseId, saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-manager-prestige-wins', {
        body: {
          phase_id: phaseId || null,
          saison_id: saisonId || null,
        },
      });

      if (error) throw error;
      
      return data as Record<string, ManagerPrestige>;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

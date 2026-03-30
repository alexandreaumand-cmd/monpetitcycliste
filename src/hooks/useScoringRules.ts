import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useScoringRules = (courseId: string, phaseId: string, categorie: string, classementType: string) => {
  const { data: scoringRules } = useQuery({
    queryKey: ["scoring-rules-studio", courseId, classementType],
    queryFn: async () => {
      // 1. Get the saison from the phase
      const { data: phaseData, error: phaseError } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', phaseId)
        .single();

      if (phaseError || !phaseData) {
        console.error('Error fetching phase:', phaseError);
        return [];
      }

      // 2. Map classement type
      const typeMap: Record<string, string> = {
        Etape: "Etape",
        General: "General",
        Points: "Points",
        Montagne: "Montagne",
        Jeune: "Jeune",
        Combatif: "Combatif",
      };
      const typeClassementValue = typeMap[classementType] || classementType;

      // 3. Fetch scoring rules
      const { data: rulesData, error: rulesError } = await supabase
        .from("scoring_rules_saisons")
        .select("place, points")
        .eq("saison_id", phaseData.saison_id)
        .eq("categorie", categorie)
        .eq("type_classement", typeClassementValue as any)
        .order("place");

      if (rulesError) {
        console.error('Error fetching scoring rules:', rulesError);
        return [];
      }

      return rulesData || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return { scoringRules };
};

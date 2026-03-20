import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuctionPhaseInfo {
  phaseId: string;
  phaseIndex: number;
  seasonYear: number;
  hasClosedRounds: boolean;
  budget: number;
  maxRiders: number;
}

/**
 * Fetches all phases that have auctions for a given league,
 * ordered by season year desc, phase index desc.
 */
export function useLeagueAuctionPhases(leagueId: string | null) {
  return useQuery({
    queryKey: ["league-auction-phases", leagueId],
    queryFn: async (): Promise<AuctionPhaseInfo[]> => {
      if (!leagueId) return [];

      // Get league settings
      const { data: league } = await supabase
        .from("leagues")
        .select("settings")
        .eq("id", leagueId)
        .maybeSingle();

      const settings = league?.settings as { budget?: number; max_riders?: number } | null;

      // Get all distinct phase_ids that have auctions for this league
      const { data: auctions, error } = await supabase
        .from("auctions")
        .select("phase_id")
        .eq("league_id", leagueId);

      if (error) throw error;
      if (!auctions?.length) return [];

      const phaseIds = [...new Set(auctions.map((a) => a.phase_id))];

      // Get phase details with season info
      const { data: phases, error: phasesError } = await supabase
        .from("phases")
        .select("id, index_dans_saison, budget, max_coureurs, saisons(annee)")
        .in("id", phaseIds);

      if (phasesError) throw phasesError;
      if (!phases?.length) return [];

      // Check which phases have closed rounds
      const { data: closedAuctions } = await supabase
        .from("auctions")
        .select("phase_id")
        .eq("league_id", leagueId)
        .eq("statut", "closed");

      const closedPhaseIds = new Set(closedAuctions?.map((a) => a.phase_id) || []);

      return phases
        .map((p) => ({
          phaseId: p.id,
          phaseIndex: p.index_dans_saison,
          seasonYear: (p.saisons as any)?.annee || 0,
          hasClosedRounds: closedPhaseIds.has(p.id),
          budget: settings?.budget ?? p.budget ?? 100,
          maxRiders: settings?.max_riders ?? p.max_coureurs ?? 25,
        }))
        .sort((a, b) => b.seasonYear - a.seasonYear || b.phaseIndex - a.phaseIndex);
    },
    enabled: !!leagueId,
  });
}

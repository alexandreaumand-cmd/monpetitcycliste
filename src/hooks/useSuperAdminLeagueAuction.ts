import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SuperAdminAuctionInfo = {
  auctionId: string;
  status: "open" | "closed" | "scheduled";
  roundNumber: number;
  phaseId: string | null;
  phaseIndex: number | null;
  opensAt: string | null;
  deadlineAt: string | null;
  closedAt: string | null;
};

/**
 * Lightweight auction status fetcher for the super-admin views.
 * Returns the most relevant auction for a league (open > closed-recent > next scheduled).
 */
export function useSuperAdminLeagueAuction(leagueId: string | null) {
  return useQuery({
    queryKey: ["super-admin-league-auction", leagueId],
    enabled: !!leagueId,
    refetchInterval: 30000,
    queryFn: async (): Promise<SuperAdminAuctionInfo | null> => {
      if (!leagueId) return null;

      // 1. Open auction (highest priority)
      const { data: openA } = await supabase
        .from("auctions")
        .select("id, statut, round_number, phase_id, opens_at, deadline_at, closed_at")
        .eq("league_id", leagueId)
        .eq("statut", "open")
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      let chosen = openA;

      // 2. Otherwise most recent closed
      if (!chosen) {
        const { data: closedA } = await supabase
          .from("auctions")
          .select("id, statut, round_number, phase_id, opens_at, deadline_at, closed_at")
          .eq("league_id", leagueId)
          .eq("statut", "closed")
          .order("closed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        chosen = closedA;
      }

      // 3. Otherwise next scheduled
      if (!chosen) {
        const { data: schedA } = await supabase
          .from("auctions")
          .select("id, statut, round_number, phase_id, opens_at, deadline_at, closed_at")
          .eq("league_id", leagueId)
          .eq("statut", "scheduled")
          .not("opens_at", "is", null)
          .order("opens_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        chosen = schedA;
      }

      if (!chosen) return null;

      // Resolve phase index if available
      let phaseIndex: number | null = null;
      if (chosen.phase_id) {
        const { data: phase } = await supabase
          .from("phases")
          .select("index_dans_saison")
          .eq("id", chosen.phase_id)
          .maybeSingle();
        phaseIndex = phase?.index_dans_saison ?? null;
      }

      return {
        auctionId: chosen.id,
        status: chosen.statut as "open" | "closed" | "scheduled",
        roundNumber: chosen.round_number,
        phaseId: chosen.phase_id,
        phaseIndex,
        opensAt: chosen.opens_at,
        deadlineAt: chosen.deadline_at,
        closedAt: chosen.closed_at,
      };
    },
  });
}

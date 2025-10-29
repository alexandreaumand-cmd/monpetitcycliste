import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { RoundHistoryTab } from "./RoundHistoryTab";
import { PhaseRecapTab } from "./PhaseRecapTab";
import { FinalTeamTab } from "./FinalTeamTab";

interface AuctionPhaseHistoryViewProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
  budget: number;
  maxRiders: number;
}

export function AuctionPhaseHistoryView({
  phaseId,
  managerId,
  leagueId,
  budget,
  maxRiders,
}: AuctionPhaseHistoryViewProps) {
  // Fetch all closed auctions for this phase
  const { data: closedRounds = [], isLoading } = useQuery({
    queryKey: ["phase-closed-rounds", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("auctions")
        .select("id, round_number, closed_at")
        .eq("phase_id", phaseId)
        .eq("statut", "closed")
        .order("round_number", { ascending: true });

      if (leagueId) query = query.eq("league_id", leagueId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <Tabs defaultValue="recap" className="space-y-6">
        <TabsList className="grid w-full grid-cols-auto gap-2 overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="recap">📊 Récapitulatif</TabsTrigger>
          {closedRounds.map((round) => (
            <TabsTrigger key={round.round_number} value={`round-${round.round_number}`}>
              Round {round.round_number}
            </TabsTrigger>
          ))}
          <TabsTrigger value="my-team">👥 Mon Équipe</TabsTrigger>
        </TabsList>

        <TabsContent value="recap">
          <PhaseRecapTab phaseId={phaseId} leagueId={leagueId} />
        </TabsContent>

        {closedRounds.map((round) => (
          <TabsContent key={round.round_number} value={`round-${round.round_number}`}>
            <RoundHistoryTab
              phaseId={phaseId}
              managerId={managerId}
              leagueId={leagueId}
              roundNumber={round.round_number}
              closedAt={round.closed_at}
            />
          </TabsContent>
        ))}

        <TabsContent value="my-team">
          <FinalTeamTab
            phaseId={phaseId}
            managerId={managerId}
            leagueId={leagueId}
            budget={budget}
            maxRiders={maxRiders}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

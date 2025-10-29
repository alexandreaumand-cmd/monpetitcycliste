import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Trophy, Database } from "lucide-react";
import { RoundHistoryTab } from "./RoundHistoryTab";
import { PhaseRecapTab } from "./PhaseRecapTab";
import { FinalTeamTab } from "./FinalTeamTab";
import { AuctionDatabaseTab } from "./AuctionDatabaseTab";

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
    <div className="container max-w-7xl mx-auto px-4 py-6 md:px-6 space-y-6">
      <Tabs defaultValue="recap" className="space-y-6">
        <ScrollArea className="w-full">
          <TabsList className="inline-flex h-12 items-center justify-start rounded-lg bg-muted p-1 w-full md:w-auto">
            <TabsTrigger 
              value="recap" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Récapitulatif</span>
              <span className="sm:hidden">Recap</span>
            </TabsTrigger>

            <TabsTrigger 
              value="database" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Base de données</span>
              <span className="sm:hidden">DB</span>
            </TabsTrigger>
            
            {closedRounds.map((round) => (
              <TabsTrigger 
                key={round.round_number} 
                value={`round-${round.round_number}`}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <span className="font-semibold">R{round.round_number}</span>
              </TabsTrigger>
            ))}
            
            <TabsTrigger 
              value="my-team"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Mon Équipe</span>
              <span className="sm:hidden">Équipe</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

            <TabsContent value="recap" className="animate-fade-in">
              <PhaseRecapTab phaseId={phaseId} leagueId={leagueId} />
            </TabsContent>

            <TabsContent value="database" className="animate-fade-in">
              <AuctionDatabaseTab phaseId={phaseId} leagueId={leagueId} />
            </TabsContent>

            {closedRounds.map((round) => (
          <TabsContent 
            key={round.round_number} 
            value={`round-${round.round_number}`}
            className="animate-fade-in"
          >
            <RoundHistoryTab
              phaseId={phaseId}
              managerId={managerId}
              leagueId={leagueId}
              roundNumber={round.round_number}
              closedAt={round.closed_at}
            />
          </TabsContent>
        ))}

        <TabsContent value="my-team" className="animate-fade-in">
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

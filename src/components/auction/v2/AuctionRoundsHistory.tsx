import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2 } from "lucide-react";
import { RoundHistoryTab } from "./RoundHistoryTab";
import { useState } from "react";

interface AuctionRoundsHistoryProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
  onBack: () => void;
}

export function AuctionRoundsHistory({ phaseId, managerId, leagueId, onBack }: AuctionRoundsHistoryProps) {
  const [selectedRound, setSelectedRound] = useState<string | null>(null);

  // Fetch all closed auctions for this phase/league
  const { data: closedAuctions, isLoading } = useQuery({
    queryKey: ["closed-auctions-history", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("auctions")
        .select("id, round_number, closed_at")
        .eq("phase_id", phaseId)
        .eq("statut", "closed");

      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }

      const { data, error } = await query.order("round_number", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Set default selected round to the first one
  const effectiveSelectedRound = selectedRound || closedAuctions?.[0]?.id;
  const selectedAuction = closedAuctions?.find((a) => a.id === effectiveSelectedRound);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!closedAuctions || closedAuctions.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div className="flex items-center justify-center flex-1 text-center">
          <p className="text-muted-foreground">Aucun round clôturé pour le moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Historique des enchères</h1>
        </div>
      </div>

      {/* Tabs for rounds */}
      <Tabs
        value={effectiveSelectedRound}
        onValueChange={setSelectedRound}
        className="w-full"
      >
        <div className="px-4 pt-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            {closedAuctions.map((auction) => (
              <TabsTrigger key={auction.id} value={auction.id} className="flex-shrink-0">
                Round {auction.round_number}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {closedAuctions.map((auction) => (
          <TabsContent key={auction.id} value={auction.id} className="mt-0 p-4">
            <RoundHistoryTab
              phaseId={phaseId}
              managerId={managerId}
              leagueId={leagueId}
              roundNumber={auction.round_number}
              closedAt={auction.closed_at}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

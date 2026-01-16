import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import { RoundHistoryTab } from "./RoundHistoryTab";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface AuctionRoundsHistoryProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
  onBack: () => void;
}

export function AuctionRoundsHistory({ phaseId, managerId, leagueId, onBack }: AuctionRoundsHistoryProps) {
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>(managerId);

  // Fetch all managers in the league
  const { data: leagueManagers = [] } = useQuery({
    queryKey: ["league-managers-history", leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      
      // First get league members
      const { data: members, error: membersError } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", leagueId);
      
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];
      
      // Then get managers for those users
      const userIds = members.map(m => m.user_id);
      const { data: managers, error: managersError } = await supabase
        .from("managers")
        .select("id, nom, avatar_url")
        .in("user_id", userIds);
      
      if (managersError) throw managersError;
      return managers || [];
    },
    enabled: !!leagueId,
  });

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

      {/* Manager Navigation */}
      {leagueManagers.length > 1 && (
        <div className="px-4 pt-4">
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {leagueManagers
                .sort((a, b) => (a.id === managerId ? -1 : b.id === managerId ? 1 : 0))
                .map((manager) => (
                  <Button
                    key={manager.id}
                    variant={selectedManagerId === manager.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedManagerId(manager.id)}
                    className="flex-shrink-0 gap-2"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={manager.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {manager.nom.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {manager.id === managerId && <Star className="h-3 w-3 fill-current" />}
                    {manager.nom}
                  </Button>
                ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

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
              managerId={selectedManagerId}
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

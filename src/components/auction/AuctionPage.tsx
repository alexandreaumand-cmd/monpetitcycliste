import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Users } from "lucide-react";
import { AuctionHeader } from "./AuctionHeader";
import { AuctionSidePanel } from "./AuctionSidePanel";
import { NextAuctionCard } from "./NextAuctionCard";
import { LastRoundResults } from "./LastRoundResults";
import { RoundHistorySelector } from "./RoundHistorySelector";
import { BidFormWithHelp } from "./BidFormWithHelp";
import { BidHistory } from "./BidHistory";
import { AuctionTeamsGrid } from "./AuctionTeamsGrid";
import { useLeague } from "@/contexts/LeagueContext";
import { MemberWriteGuard } from "@/components/guards/MemberWriteGuard";

interface AuctionPageProps {
  phaseId: string;
  managerId: string;
}

export const AuctionPage = ({ phaseId, managerId }: AuctionPageProps) => {
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();

  // Get open auction (if exists)
  const { data: openAuction } = useQuery({
    queryKey: ['open-auction', phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from('auctions')
        .select('id, round_number, deadline_at, phase_id')
        .eq('phase_id', phaseId)
        .eq('statut', 'open');
      
      if (leagueId) {
        query = query.eq('league_id', leagueId);
      }

      const { data, error } = await query
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!leagueId,
  });

  // Get manager phase status
  const { data: phaseStatus } = useQuery({
    queryKey: ['manager-phase-status', managerId, phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_phase_status')
        .select('*')
        .eq('manager_id', managerId)
        .eq('phase_id', phaseId)
        .single();

      if (error) throw error;
      return data;
    }
  });

  // Get current round drafts summary (only if open auction exists)
  const { data: roundDrafts } = useQuery({
    queryKey: ['current-round-drafts', managerId, openAuction?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_round_drafts')
        .select('*')
        .eq('manager_id', managerId)
        .eq('auction_id', openAuction!.id)
        .maybeSingle();

      if (error) throw error;
      return data || { draft_count: 0, draft_sum: 0 };
    },
    enabled: !!openAuction
  });

  // Get bid outcomes counts
  const { data: outcomeCounts } = useQuery({
    queryKey: ['bid-outcome-counts', managerId, phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids_outcomes')
        .select('outcome')
        .eq('manager_id', managerId)
        .eq('phase_id', phaseId);

      if (error) throw error;

      const won = data.filter(b => b.outcome === 'won').length;
      const lost = data.filter(b => b.outcome === 'lost').length;
      const carried = data.filter(b => b.outcome === 'carried_over').length;

      return { won, lost, carried };
    }
  });

  // Get managers count
  const { data: managersStatus = [] } = useQuery({
    queryKey: ['managers-rosters-status', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managers_rosters_status')
        .select('*')
        .eq('phase_id', phaseId)
        .neq('manager_id', managerId);

      if (error) throw error;
      return data || [];
    }
  });

  const completeManagers = managersStatus.filter(m => m.slots_restants === 0).length;

  // Check if ready to submit
  const isReady = openAuction && phaseStatus && roundDrafts && 
    roundDrafts.draft_count === phaseStatus.slots_restants &&
    Math.abs(parseFloat(phaseStatus.budget_restant.toString()) - roundDrafts.draft_sum) < 1;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['draft-bids'] });
    queryClient.invalidateQueries({ queryKey: ['submitted-bids'] });
    queryClient.invalidateQueries({ queryKey: ['manager-phase-status'] });
    queryClient.invalidateQueries({ queryKey: ['current-round-drafts'] });
    queryClient.invalidateQueries({ queryKey: ['all-managers-rosters'] });
    queryClient.invalidateQueries({ queryKey: ['managers-rosters-status'] });
    queryClient.invalidateQueries({ queryKey: ['open-auction'] });
  };

  return (
    <div className="min-h-screen pb-8">
      {openAuction && (
        <AuctionHeader 
          auction={openAuction} 
          phaseStatus={phaseStatus || null} 
          onRefresh={handleRefresh}
        />
      )}

      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Enchères</h1>
          <AuctionSidePanel 
            phaseId={phaseId}
            managerId={managerId}
            open={sidePanelOpen}
            onOpenChange={setSidePanelOpen}
          />
        </div>

        {/* Next auction card - only if no open auction */}
        {!openAuction && <NextAuctionCard phaseId={phaseId} />}

        {/* Ready to submit alert - only if open auction */}
        {isReady && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-400">
              ✅ Vos enchères sont prêtes à être validées !
            </AlertDescription>
          </Alert>
        )}

        {/* Bloc "Préparer mes enchères" - only if open auction */}
        {openAuction && (
          <MemberWriteGuard>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">
                Préparer mes enchères — Round {openAuction.round_number}
              </h2>
              <BidFormWithHelp auction={openAuction} managerId={managerId} />
            </div>
          </MemberWriteGuard>
        )}

        {/* Dernier round - Résultats */}
        <LastRoundResults phaseId={phaseId} managerId={managerId} />

        {/* Historique des rounds */}
        <RoundHistorySelector phaseId={phaseId} managerId={managerId} />

        {/* Other tabs */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="history" className="gap-2">
              Historique complet
              {outcomeCounts && (
                <Badge variant="outline" className="ml-1">
                  {outcomeCounts.won}🟢 · {outcomeCounts.lost}🔴 · {outcomeCounts.carried}🟨
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              Équipes
              <Badge variant="outline" className="ml-1 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {managersStatus.length}
                {completeManagers > 0 && ` · ${completeManagers} complet(s)`}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-6">
            <BidHistory managerId={managerId} phaseId={phaseId} />
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <AuctionTeamsGrid phaseId={phaseId} managerId={managerId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

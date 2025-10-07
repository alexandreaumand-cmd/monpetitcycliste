import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BidFormWithHelp } from "./BidFormWithHelp";
import { BidHistory } from "./BidHistory";
import { AuctionTeamsGrid } from "./AuctionTeamsGrid";
import { AuctionHeader } from "./AuctionHeader";
import { AuctionSidePanel } from "./AuctionSidePanel";
import { NextAuctionCard } from "./NextAuctionCard";
import { LastRoundResults } from "./LastRoundResults";
import { useState } from "react";
import { CheckCircle2, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatAmount } from "@/lib/utils";

interface AuctionTabsProps {
  auction: {
    id: string;
    round_number: number;
    phase_id: string;
    deadline_at: string;
  };
  managerId: string;
}

export const AuctionTabs = ({ auction, managerId }: AuctionTabsProps) => {
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const queryClient = useQueryClient();

  // Get manager phase status
  const { data: phaseStatus } = useQuery({
    queryKey: ['manager-phase-status', managerId, auction.phase_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_phase_status')
        .select('*')
        .eq('manager_id', managerId)
        .eq('phase_id', auction.phase_id)
        .single();

      if (error) throw error;
      return data;
    }
  });

  // Get current round drafts summary
  const { data: roundDrafts } = useQuery({
    queryKey: ['current-round-drafts', managerId, auction.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_round_drafts')
        .select('*')
        .eq('manager_id', managerId)
        .eq('auction_id', auction.id)
        .maybeSingle();

      if (error) throw error;
      return data || { draft_count: 0, draft_sum: 0 };
    }
  });

  // Get bid outcomes counts
  const { data: outcomeCounts } = useQuery({
    queryKey: ['bid-outcome-counts', managerId, auction.phase_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids_outcomes')
        .select('outcome')
        .eq('manager_id', managerId)
        .eq('phase_id', auction.phase_id);

      if (error) throw error;

      const won = data.filter(b => b.outcome === 'won').length;
      const lost = data.filter(b => b.outcome === 'lost').length;
      const carried = data.filter(b => b.outcome === 'carried_over').length;

      return { won, lost, carried };
    }
  });

  // Get managers count
  const { data: managersStatus = [] } = useQuery({
    queryKey: ['managers-rosters-status', auction.phase_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managers_rosters_status')
        .select('*')
        .eq('phase_id', auction.phase_id)
        .neq('manager_id', managerId);

      if (error) throw error;
      return data || [];
    }
  });

  const completeManagers = managersStatus.filter(m => m.slots_restants === 0).length;

  // Check if ready to submit
  const isReady = phaseStatus && roundDrafts && 
    roundDrafts.draft_count === phaseStatus.slots_restants &&
    Math.abs(parseFloat(phaseStatus.budget_restant.toString()) - roundDrafts.draft_sum) < 1;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['draft-bids'] });
    queryClient.invalidateQueries({ queryKey: ['submitted-bids'] });
    queryClient.invalidateQueries({ queryKey: ['manager-phase-status'] });
    queryClient.invalidateQueries({ queryKey: ['current-round-drafts'] });
    queryClient.invalidateQueries({ queryKey: ['all-managers-rosters'] });
    queryClient.invalidateQueries({ queryKey: ['managers-rosters-status'] });
  };

  return (
    <div className="min-h-screen pb-8">
      <AuctionHeader 
        auction={auction} 
        phaseStatus={phaseStatus || null} 
        onRefresh={handleRefresh}
      />

      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Enchères</h1>
          <AuctionSidePanel 
            phaseId={auction.phase_id}
            managerId={managerId}
            open={sidePanelOpen}
            onOpenChange={setSidePanelOpen}
          />
        </div>

        {/* Next auction card */}
        <NextAuctionCard phaseId={auction.phase_id} />

        {/* Last round results */}
        <LastRoundResults phaseId={auction.phase_id} managerId={managerId} />

        {isReady && (
          <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-400">
              ✅ Vos enchères sont prêtes à être validées !
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="prepare" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="prepare" className="gap-2">
              Préparer
              {phaseStatus && roundDrafts && (
                <Badge variant="secondary" className="ml-1">
                  {roundDrafts.draft_count}/{phaseStatus.slots_restants} • {formatAmount(roundDrafts.draft_sum)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              Historique
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

          <TabsContent value="prepare" className="mt-6">
            <BidFormWithHelp auction={auction} managerId={managerId} />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <BidHistory managerId={managerId} phaseId={auction.phase_id} />
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <AuctionTeamsGrid phaseId={auction.phase_id} managerId={managerId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

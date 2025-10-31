import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuctionHeaderMobile } from "./AuctionHeaderMobile";
import { FiltersDrawer } from "./FiltersDrawer";
import { RiderResultsList } from "./RiderResultsList";
import { BidAmountBottomSheet } from "./BidAmountBottomSheet";
import { MyBidsList } from "./MyBidsList";
import { AuctionSubmitButton } from "./AuctionSubmitButton";
import { AuctionValidationConfirmation } from "./AuctionValidationConfirmation";
import { MyValidatedBids } from "./MyValidatedBids";
import { AuctionLiveAnnouncements } from "./AuctionLiveAnnouncements";
import { AuctionCompletedView } from "./AuctionCompletedView";
import { AuctionPhaseHistoryView } from "./AuctionPhaseHistoryView";
import { AuctionScheduledView } from "./AuctionScheduledView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "use-debounce";

interface AuctionPageMobileProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
}

export function AuctionPageMobile({ phaseId, managerId, leagueId }: AuctionPageMobileProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedCotes, setSelectedCotes] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'nom' | 'cote'>('cote');
  const [selectedRider, setSelectedRider] = useState<any>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [showValidationScreen, setShowValidationScreen] = useState(false);
  const [showMyValidatedBids, setShowMyValidatedBids] = useState(false);
  const [hideLiveAnnouncements, setHideLiveAnnouncements] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [debouncedSearch] = useDebounce(searchQuery, 250);

  // Get auction context
  const { data: context, isLoading: contextLoading } = useQuery({
    queryKey: ["auction-context", phaseId, managerId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-get-context", {
        body: { phase_id: phaseId, manager_id: managerId, league_id: leagueId },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  // Get last closed auction if no active auction
  const { data: lastClosedAuction } = useQuery({
    queryKey: ["last-closed-auction", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from('auctions')
        .select('id, closed_at, round_number')
        .eq('phase_id', phaseId)
        .eq('statut', 'closed');
      
      if (leagueId) {
        query = query.eq('league_id', leagueId);
      }
      
      const { data, error } = await query
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: context === null, // Only fetch if no active auction
  });

  // Get next scheduled auction if no active auction
  const { data: scheduledAuction } = useQuery({
    queryKey: ["scheduled-auction", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from('auctions')
        .select('id, opens_at, round_number, phase_id')
        .eq('statut', 'scheduled');
      
      if (leagueId) {
        query = query.eq('league_id', leagueId);
      }
      
      if (phaseId) {
        query = query.eq('phase_id', phaseId);
      }
      
      const { data, error } = await query
        .order('opens_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: context === null, // Only fetch if no active auction
  });

  // Auto-show validation screen if manager has already validated and has no active drafts
  useEffect(() => {
    if (context?.validation_status?.has_validated && context?.auction_id && (context?.my_bids?.length ?? 0) === 0) {
      setShowValidationScreen(true);
    }
  }, [context?.validation_status?.has_validated, context?.auction_id, context?.my_bids?.length]);

  // Reset hideLiveAnnouncements when a new open auction appears
  useEffect(() => {
    if (context?.auction?.statut === 'open') {
      setHideLiveAnnouncements(false);
    }
  }, [context?.auction?.statut]);

  // Check if we should show live announcements screen
  const shouldShowLiveScreen = context?.auction?.statut === 'closed' && context?.auction_id && !hideLiveAnnouncements;

  // Fetch available teams from database
  const { data: availableTeams = [] } = useQuery({
    queryKey: ["auction-teams", phaseId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-get-teams", {
        body: { phase_id: phaseId },
      });
      if (error) throw error;
      const teams = data?.teams || [];
      return Array.isArray(teams) ? teams : [];
    },
  });

  // Search riders
  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: [
      "auction-search-riders",
      phaseId,
      leagueId,
      debouncedSearch,
      selectedTeams,
      selectedCotes,
      selectedCategories,
      sortOrder,
      context?.my_bids?.map((b: any) => b.coureur_id) || [],
    ],
    queryFn: async () => {
      // Convert selectedCotes to min/max ranges
      let cote_min: number | null = null;
      let cote_max: number | null = null;
      
      if (selectedCotes.length > 0) {
        const sortedCotes = [...selectedCotes].sort((a, b) => a - b);
        cote_min = sortedCotes[0];
        
        // If 101 (100+) is selected, set max to null (no limit)
        if (sortedCotes.includes(101)) {
          cote_max = null;
        } else {
          cote_max = sortedCotes[sortedCotes.length - 1];
        }
      }
      
      const { data, error } = await supabase.functions.invoke("auction-search-riders", {
        body: {
          phase_id: phaseId,
          league_id: leagueId,
          q: debouncedSearch || null,
          teams: selectedTeams.length > 0 ? selectedTeams : null,
          categories: selectedCategories.length > 0 ? selectedCategories : null,
          cote_min,
          cote_max,
          exclude_rider_ids: context?.my_bids?.map((b: any) => b.coureur_id) || [],
          available_only: true,
          limit: 100,
          order_by: sortOrder,
        },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!context,
  });

  // Upsert bid mutation
  const upsertBidMutation = useMutation({
    mutationFn: async ({ rider_id, amount }: { rider_id: string; amount: number }) => {
      const { data, error } = await supabase.functions.invoke("auction-upsert-bid", {
        body: { phase_id: phaseId, rider_id, amount, league_id: leagueId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auction-context", phaseId, managerId, leagueId] });
      toast({ title: "Enchère enregistrée" });
      
      // Show budget warning if exceeded
      if (data?.warnings && data.warnings.length > 0) {
        toast({ 
          title: "⚠️ Attention", 
          description: data.warnings[0],
          variant: "destructive" 
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Erreur lors de l'enregistrement de l'enchère";
      toast({ 
        title: "Erreur", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  // Remove bid mutation
  const removeBidMutation = useMutation({
    mutationFn: async (bid_id: string) => {
      const { data, error } = await supabase.functions.invoke("auction-remove-bid", {
        body: { bid_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction-context", phaseId, managerId, leagueId] });
      toast({ title: "Enchère supprimée" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer l'enchère",
        variant: "destructive",
      });
    },
  });

  // Submit all bids mutation
  const submitAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-submit-all-bids", {
        body: { phase_id: phaseId, manager_id: managerId, league_id: leagueId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction-context", phaseId, managerId, leagueId] });
      setShowSubmitDialog(false);
      setShowValidationScreen(true);
    },
    onError: (error: any) => {
      toast({
        title: "Validation impossible",
        description: error.message || "Vérifie que toutes les conditions sont remplies",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleAddRider = (rider: any) => {
    setSelectedRider(rider);
    setIsBottomSheetOpen(true);
  };

  const handleSubmitBid = (amount: number) => {
    if (selectedRider) {
      upsertBidMutation.mutate({
        rider_id: selectedRider.rider_id,
        amount,
      });
    }
  };

  const handleUpdateAmount = (bid_id: string, coureur_id: string, amount: number) => {
    upsertBidMutation.mutate({ rider_id: coureur_id, amount });
  };

  const handleRemoveBid = (bid_id: string) => {
    removeBidMutation.mutate(bid_id);
  };

  const handleSubmitAll = () => {
    setShowSubmitDialog(true);
  };

  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show live announcements for last closed auction if no active auction
  if (!context && lastClosedAuction && !hideLiveAnnouncements) {
    return (
      <AuctionLiveAnnouncements
        auctionId={lastClosedAuction.id}
        managerId={managerId}
        phaseId={phaseId}
        onBack={() => setHideLiveAnnouncements(true)}
      />
    );
  }

  // Show scheduled auction countdown if exists
  if (!context && scheduledAuction) {
    return (
      <AuctionScheduledView
        opensAt={scheduledAuction.opens_at}
        roundNumber={scheduledAuction.round_number}
        phaseId={phaseId}
        leagueId={leagueId}
      />
    );
  }

  if (!context) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 text-center">
        <div>
          <p className="text-muted-foreground">Aucune enchère programmée</p>
          <p className="text-sm text-muted-foreground mt-2">
            Les enchères n'ont pas encore été planifiées
          </p>
        </div>
      </div>
    );
  }

  // Show live announcements screen if round is closed
  if (shouldShowLiveScreen) {
    return (
      <AuctionLiveAnnouncements
        auctionId={context.auction_id}
        managerId={managerId}
        phaseId={phaseId}
        onBack={() => setHideLiveAnnouncements(true)}
      />
    );
  }

  if (showValidationScreen && showMyValidatedBids) {
    return (
      <MyValidatedBids
        phaseId={phaseId}
        managerId={managerId}
        leagueId={leagueId}
        onBack={() => setShowMyValidatedBids(false)}
      />
    );
  }

  if (showValidationScreen) {
    return (
      <AuctionValidationConfirmation
        phaseId={phaseId}
        managerId={managerId}
        leagueId={leagueId}
        onBack={() => setShowValidationScreen(false)}
        onViewMyBids={() => setShowMyValidatedBids(true)}
      />
    );
  }

  // Check if phase is complete (all managers done)
  const isPhaseComplete = context?.phase_complete === true;

  if (isPhaseComplete) {
    return (
      <AuctionPhaseHistoryView
        phaseId={phaseId}
        managerId={managerId}
        leagueId={leagueId}
        budget={context.starting_budget}
        maxRiders={context.rules.max_bids}
      />
    );
  }

  // Check if roster is complete
  const isRosterComplete = context.totals.roster_count >= context.rules.max_bids;

  if (isRosterComplete) {
    return (
      <AuctionCompletedView
        roster={context.roster}
        budget_spent={context.totals.budget_spent}
        starting_budget={context.starting_budget}
        currency={context.currency}
        max_slots={context.rules.max_bids}
        phaseId={phaseId}
        managerId={managerId}
        leagueId={leagueId}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-32">
      {/* Compact Header */}
      <AuctionHeaderMobile
        starting_budget={context.starting_budget}
        draft_sum={context.totals.draft_sum}
        remaining_budget={context.totals.remaining_budget}
        budget_spent={context.totals.budget_spent}
        currency={context.currency}
        validation_status={context.validation_status}
        draft_count={context.totals.draft_count}
        roster_count={context.totals.roster_count}
        max_slots={context.rules.max_bids}
        deadline_at={context.auction?.deadline_at}
        validated_count={context.validated_count}
        total_managers={context.total_managers}
        phase_index={context.phase_index}
        onSubmit={handleSubmitAll}
        isSubmitting={submitAllMutation.isPending}
      />

      {/* Tabs: Mes Enchères / Recherche */}
      <Tabs defaultValue="search" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2 grid grid-cols-2 h-9" style={{ width: "calc(100% - 1.5rem)" }}>
          <TabsTrigger value="my-bids" className="text-xs">
            📝 Enchères ({context.totals.draft_count})
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs">
            🔎 Chercher
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-bids" className="flex-1 mt-0 pt-2 flex flex-col">
          <div className="flex-1 overflow-y-auto pb-4">
            <MyBidsList
              bids={[...(context.roster || []), ...(context.my_bids || [])]}
              onUpdateAmount={handleUpdateAmount}
              onRemove={handleRemoveBid}
              currency={context.currency}
              step={context.rules.step}
              isUpdating={upsertBidMutation.isPending || removeBidMutation.isPending}
            />
          </div>
        </TabsContent>

        <TabsContent value="search" className="flex-1 mt-0 flex flex-col">
          {/* Search bar - Sticky at top */}
          <div className="px-3 py-2 border-b bg-background sticky top-0 z-10">
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher un coureur…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-10 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            </div>
          </div>
          
          {/* Scrollable results list */}
          <div className="flex-1 overflow-y-auto">
            <RiderResultsList
              riders={ridersData?.items || []}
              onAddRider={handleAddRider}
              isLoading={ridersLoading}
              onSortChange={setSortOrder}
              currentSort={sortOrder}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Filters FAB */}
      <FiltersDrawer
        selectedTeams={selectedTeams}
        onTeamsChange={setSelectedTeams}
        selectedCotes={selectedCotes}
        onCotesChange={setSelectedCotes}
        selectedCategories={selectedCategories}
        onCategoriesChange={setSelectedCategories}
        availableTeams={availableTeams}
      />

      {/* Bottom Sheet */}
      <BidAmountBottomSheet
        open={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        rider={selectedRider}
        onSubmit={handleSubmitBid}
        remainingBudget={context.totals.remaining_budget}
        currency={context.currency}
        step={context.rules.step}
      />

      {/* Submit confirmation dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la validation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tu es sur le point de valider tes enchères. Une fois validées,
                  tu ne pourras plus les modifier.
                </p>
                <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nombre d'enchères:</span>
                    <span className="font-medium">{context.totals.draft_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant total:</span>
                    <span className="font-medium">
                      {context.totals.draft_sum}
                    </span>
                  </div>
                </div>
                <p className="text-sm">Es-tu sûr de vouloir continuer ?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => submitAllMutation.mutate()}>
              Valider définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

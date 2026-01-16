import { useState, useMemo, useEffect } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuctionHeader } from "./AuctionHeader";
import { AuctionSearchFilters } from "./AuctionSearchFilters";
import { RiderResultsList } from "./RiderResultsList";
import { BidAmountPopover } from "./BidAmountPopover";
import { MyBidsList } from "./MyBidsList";
import { AuctionValidationConfirmation } from "./AuctionValidationConfirmation";
import { MyValidatedBids } from "./MyValidatedBids";
import { AuctionLiveAnnouncements } from "./AuctionLiveAnnouncements";
import { AuctionTabs } from "./AuctionTabs";
import { AuctionCompletedView } from "./AuctionCompletedView";
import { AuctionPhaseHistoryView } from "./AuctionPhaseHistoryView";
import { AuctionScheduledView } from "./AuctionScheduledView";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "use-debounce";
import { useLeague } from "@/contexts/LeagueContext";
import { MemberWriteGuard } from "@/components/guards/MemberWriteGuard";
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

interface AuctionPageDesktopProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
}

export function AuctionPageDesktop({ phaseId, managerId, leagueId }: AuctionPageDesktopProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedCotes, setSelectedCotes] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'nom' | 'cote'>('cote');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showValidationScreen, setShowValidationScreen] = useState(false);
  const [showMyValidatedBids, setShowMyValidatedBids] = useState(false);
  const [hideLiveAnnouncements, setHideLiveAnnouncements] = useState(false);
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
    refetchInterval: 10000,
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

  // Get available teams
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

  // Search riders with infinite pagination
  const {
    data: ridersPages,
    isLoading: ridersLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "auction-search-riders-infinite",
      phaseId,
      leagueId,
      debouncedSearch,
      selectedTeams,
      selectedCotes,
      selectedCategories,
      sortOrder,
      context?.my_bids?.map((b: any) => b.coureur_id) || [],
    ],
    queryFn: async ({ pageParam = 0 }) => {
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
          offset: pageParam,
          order_by: sortOrder,
        },
      });
      if (error) throw error;
      return data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage?.pagination?.has_more) {
        return (lastPage.pagination.offset || 0) + 100;
      }
      return undefined;
    },
    enabled: !!context,
  });

  // Flatten pages into single list
  const ridersData = useMemo(() => {
    if (!ridersPages?.pages) return { items: [] };
    return {
      items: ridersPages.pages.flatMap((page) => page.items || []),
    };
  }, [ridersPages]);

  // Mutations
  const upsertBidMutation = useMutation({
    mutationFn: async ({ rider_id, amount }: { rider_id: string; amount: number }) => {
      const { data, error } = await supabase.functions.invoke("auction-upsert-bid", {
        body: { phase_id: phaseId, rider_id, amount, league_id: leagueId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auction-context", phaseId, managerId] });
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

  const removeBidMutation = useMutation({
    mutationFn: async (bid_id: string) => {
      const { data, error } = await supabase.functions.invoke("auction-remove-bid", {
        body: { bid_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction-context", phaseId, managerId] });
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

  const submitAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-submit-all-bids", {
        body: { phase_id: phaseId, manager_id: managerId, league_id: leagueId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction-context", phaseId, managerId] });
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

  // Import favorites mutation
  const importFavoritesMutation = useMutation({
    mutationFn: async () => {
      // 1. Get user's favorites
      const { data: favorites, error: favError } = await supabase
        .from("rider_favorites")
        .select("coureur_id")
        .eq("manager_id", managerId);
      
      if (favError) throw favError;
      if (!favorites || favorites.length === 0) {
        throw new Error("Aucun favori à importer");
      }

      const favoriteIds = favorites.map(f => f.coureur_id);

      // 2. Get riders already in roster (taken by any manager in this phase/league)
      let rosterQuery = supabase
        .from("rosters")
        .select("coureur_id")
        .eq("phase_id", phaseId);
      
      if (leagueId) {
        rosterQuery = rosterQuery.eq("league_id", leagueId);
      }

      const { data: takenRiders } = await rosterQuery;
      const takenIds = new Set((takenRiders || []).map(r => r.coureur_id));

      // 3. Get current draft bids directly from DB to avoid stale cache
      const { data: existingDrafts } = await supabase
        .from("bids")
        .select("coureur_id")
        .eq("manager_id", managerId)
        .eq("statut", "draft");
      
      const currentDraftIds = new Set(
        (existingDrafts || []).map((b) => b.coureur_id)
      );

      // 4. Filter favorites: exclude taken and already in draft
      const availableFavorites = favoriteIds.filter(
        id => !takenIds.has(id) && !currentDraftIds.has(id)
      );

      if (availableFavorites.length === 0) {
        throw new Error("Tous les favoris sont déjà pris ou dans vos enchères");
      }

      // 5. Get price info for available favorites
      const { data: ridersInfo, error: ridersError } = await supabase
        .from("coureurs_saisons")
        .select("coureur_id, prix_initial")
        .in("coureur_id", availableFavorites);
      
      if (ridersError) throw ridersError;

      // 6. Create bids for each favorite at initial price
      const results = [];
      for (const rider of ridersInfo || []) {
        const { data, error } = await supabase.functions.invoke("auction-upsert-bid", {
          body: { 
            phase_id: phaseId, 
            rider_id: rider.coureur_id, 
            amount: rider.prix_initial || 10,
            league_id: leagueId 
          },
        });
        if (error) {
          console.warn(`Failed to import favorite ${rider.coureur_id}:`, error);
        } else {
          results.push(data);
        }
      }

      return { imported: results.length, total: availableFavorites.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auction-context", phaseId, managerId] });
      toast({ 
        title: "Favoris importés", 
        description: `${data.imported} coureur${data.imported > 1 ? 's' : ''} ajouté${data.imported > 1 ? 's' : ''} à vos enchères` 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import impossible",
        description: error.message || "Erreur lors de l'import des favoris",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleSubmitBid = (amount: number, rider_id: string) => {
    upsertBidMutation.mutate({ rider_id, amount });
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

  const handleImportFavorites = () => {
    importFavoritesMutation.mutate();
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
      <div className="container max-w-6xl mx-auto p-6">
        <AuctionLiveAnnouncements
          auctionId={lastClosedAuction.id}
          managerId={managerId}
          phaseId={phaseId}
          onBack={() => setHideLiveAnnouncements(true)}
        />
      </div>
    );
  }

  // Show scheduled auction countdown if exists
  if (!context && scheduledAuction) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <AuctionScheduledView
          opensAt={scheduledAuction.opens_at}
          roundNumber={scheduledAuction.round_number}
          phaseId={phaseId}
          leagueId={leagueId}
        />
      </div>
    );
  }

  if (!context) {
    return (
      <Card className="m-8">
        <CardContent className="flex items-center justify-center p-12 text-center">
          <div>
            <p className="text-muted-foreground">Aucune enchère programmée</p>
            <p className="text-sm text-muted-foreground mt-2">
              Les enchères n'ont pas encore été planifiées
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show live announcements screen if round is closed
  if (shouldShowLiveScreen) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <AuctionLiveAnnouncements
          auctionId={context.auction_id}
          managerId={managerId}
          phaseId={phaseId}
          onBack={() => setHideLiveAnnouncements(true)}
        />
      </div>
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
        auctionId={context?.auction_id}
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
    <div className="min-h-screen">
      {/* Compact Header */}
      <AuctionHeader
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
        phase_index={context.phase_index}
      />

      <MemberWriteGuard>
        {/* Tabs */}
        <AuctionTabs
          phaseId={phaseId}
          managerId={managerId}
          leagueId={leagueId}
          context={context}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedTeams={selectedTeams}
          setSelectedTeams={setSelectedTeams}
          selectedCotes={selectedCotes}
          setSelectedCotes={setSelectedCotes}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
          availableTeams={Array.isArray(availableTeams) ? availableTeams : []}
          riders={ridersData?.items || []}
          isSearching={ridersLoading}
          myBids={[...(context.roster || []), ...(context.my_bids || [])]}
          handleSubmitBid={handleSubmitBid}
          handleUpdateAmount={handleUpdateAmount}
          handleRemoveBid={handleRemoveBid}
          handleSubmitAll={handleSubmitAll}
          handleImportFavorites={handleImportFavorites}
          isUpdating={upsertBidMutation.isPending || removeBidMutation.isPending}
          isSubmitting={submitAllMutation.isPending}
          isImportingFavorites={importFavoritesMutation.isPending}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          hasMore={hasNextPage}
          onLoadMore={fetchNextPage}
          isLoadingMore={isFetchingNextPage}
        />
      </MemberWriteGuard>

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

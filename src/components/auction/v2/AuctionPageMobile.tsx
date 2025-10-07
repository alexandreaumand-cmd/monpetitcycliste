import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuctionHeaderMobile } from "./AuctionHeaderMobile";
import { FiltersDrawer } from "./FiltersDrawer";
import { RiderResultsList } from "./RiderResultsList";
import { BidAmountBottomSheet } from "./BidAmountBottomSheet";
import { MyBidsList } from "./MyBidsList";
import { AuctionSubmitButton } from "./AuctionSubmitButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "use-debounce";
import { getTeamOptions, TEAM_FULL_NAMES } from "@/lib/teamNames";

interface AuctionPageMobileProps {
  phaseId: string;
  managerId: string;
}

export function AuctionPageMobile({ phaseId, managerId }: AuctionPageMobileProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedCotes, setSelectedCotes] = useState<number[]>([]);
  const [selectedRider, setSelectedRider] = useState<any>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const [debouncedSearch] = useDebounce(searchQuery, 250);

  // Get auction context
  const { data: context, isLoading: contextLoading } = useQuery({
    queryKey: ["auction-context", phaseId, managerId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-get-context", {
        body: { phase_id: phaseId, manager_id: managerId },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // Refresh every 10s (optimized)
    refetchOnWindowFocus: false,
  });

  // Get available teams for filter
  const availableTeams = useMemo(() => {
    const teams = Object.keys(TEAM_FULL_NAMES);
    return getTeamOptions(teams);
  }, []);

  // Search riders
  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: [
      "auction-search-riders",
      phaseId,
      debouncedSearch,
      selectedTeams,
      selectedCotes,
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
          q: debouncedSearch || null,
          teams: selectedTeams.length > 0 ? selectedTeams : null,
          cote_min,
          cote_max,
          exclude_rider_ids: context?.my_bids?.map((b: any) => b.coureur_id) || [],
          limit: 50,
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
        body: { phase_id: phaseId, manager_id: managerId, rider_id, amount },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction-context", phaseId, managerId] });
      toast({ title: "Enchère enregistrée" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer l'enchère",
        variant: "destructive",
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

  // Submit all bids mutation
  const submitAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-submit-all-bids", {
        body: { phase_id: phaseId, manager_id: managerId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction-context", phaseId, managerId] });
      toast({
        title: "Enchères validées !",
        description: "Tes enchères ont été soumises avec succès",
      });
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
    submitAllMutation.mutate();
  };

  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!context) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 text-center">
        <div>
          <p className="text-muted-foreground">Aucune enchère active</p>
          <p className="text-sm text-muted-foreground mt-2">
            Attends qu'un nouveau round soit ouvert
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      {/* Compact Header */}
      <AuctionHeaderMobile
        starting_budget={context.starting_budget}
        draft_sum={context.totals.draft_sum}
        remaining_budget={context.totals.remaining_budget}
        currency={context.currency}
        validation_status={context.validation_status}
        draft_count={context.totals.draft_count}
        max_slots={context.rules.max_bids}
        deadline_at={context.deadline_at}
        validated_count={context.validated_count}
        total_managers={context.total_managers}
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

        <TabsContent value="my-bids" className="flex-1 mt-0 pt-2">
          <MyBidsList
            bids={context.my_bids}
            onUpdateAmount={handleUpdateAmount}
            onRemove={handleRemoveBid}
            currency={context.currency}
            step={context.rules.step}
            isUpdating={upsertBidMutation.isPending || removeBidMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="search" className="flex-1 mt-0 pt-2">
          <RiderResultsList
            riders={ridersData?.items || []}
            onAddRider={handleAddRider}
            isLoading={ridersLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Filters FAB */}
      <FiltersDrawer
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTeams={selectedTeams}
        onTeamsChange={setSelectedTeams}
        selectedCotes={selectedCotes}
        onCotesChange={setSelectedCotes}
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

      {/* Submit Button - Sticky */}
      <AuctionSubmitButton
        canSubmit={context.validation_status.can_submit}
        onSubmit={handleSubmitAll}
        isSubmitting={submitAllMutation.isPending}
        draft_count={context.totals.draft_count}
        draft_sum={context.totals.draft_sum}
        currency={context.currency}
      />
    </div>
  );
}

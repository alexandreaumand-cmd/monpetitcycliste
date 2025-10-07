import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuctionHeader } from "./AuctionHeader";
import { AuctionSearchFilters } from "./AuctionSearchFilters";
import { RiderResultsList } from "./RiderResultsList";
import { BidAmountPopover } from "./BidAmountPopover";
import { MyBidsList } from "./MyBidsList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "use-debounce";
import { getTeamOptions, TEAM_FULL_NAMES } from "@/lib/teamNames";
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
}

export function AuctionPageDesktop({ phaseId, managerId }: AuctionPageDesktopProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedCotes, setSelectedCotes] = useState<number[]>([]);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

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
    refetchInterval: 5000,
  });

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

  // Mutations
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
      setShowSubmitDialog(false);
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

  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!context) {
    return (
      <Card className="m-8">
        <CardContent className="flex items-center justify-center p-12 text-center">
          <div>
            <p className="text-muted-foreground">Aucune enchère active</p>
            <p className="text-sm text-muted-foreground mt-2">
              Attends qu'un nouveau round soit ouvert
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Budget + Validation Header */}
      <AuctionHeader
        starting_budget={context.starting_budget}
        draft_sum={context.totals.draft_sum}
        remaining_budget={context.totals.remaining_budget}
        currency={context.currency}
        validation_status={context.validation_status}
        draft_count={context.totals.draft_count}
        max_slots={context.rules.max_bids}
      />

      {/* Two-column layout */}
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="grid grid-cols-3 gap-6">
          {/* Left column: Search & Results */}
          <div className="col-span-2 space-y-4">
            <Card>
              <CardContent className="p-0">
                <AuctionSearchFilters
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  selectedTeams={selectedTeams}
                  onTeamsChange={setSelectedTeams}
                  selectedCotes={selectedCotes}
                  onCotesChange={setSelectedCotes}
                  availableTeams={availableTeams}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                <RiderResultsList
                  riders={ridersData?.items || []}
                  onAddRider={() => {}}
                  isLoading={ridersLoading}
                  renderActionButton={(rider) => (
                    <BidAmountPopover
                      trigger={
                        <Button size="default" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      }
                      rider={{
                        rider_id: rider.rider_id,
                        rider_nom: rider.rider_nom,
                        rider_team: rider.rider_team,
                        cote: rider.cote,
                      }}
                      onSubmit={(amount) => handleSubmitBid(amount, rider.rider_id)}
                      remainingBudget={context?.totals.remaining_budget || 0}
                      currency={context?.currency || "€"}
                      step={context?.rules.step || 1}
                    />
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column: My Bids */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                <MyBidsList
                  bids={context.my_bids}
                  onUpdateAmount={handleUpdateAmount}
                  onRemove={handleRemoveBid}
                  currency={context.currency}
                  step={context.rules.step}
                  isUpdating={upsertBidMutation.isPending || removeBidMutation.isPending}
                />
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmitAll}
              disabled={!context.validation_status.can_submit || submitAllMutation.isPending}
              size="lg"
              className="w-full"
            >
              {submitAllMutation.isPending ? (
                "Validation en cours..."
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Valider mes enchères
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

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

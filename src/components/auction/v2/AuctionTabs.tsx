import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuctionSearchFilters } from "./AuctionSearchFilters";
import { RiderResultsList } from "./RiderResultsList";
import { MyBidsList } from "./MyBidsList";
import { AuctionTeamsGrid } from "../AuctionTeamsGrid";
import { RoundHistoryTab } from "./RoundHistoryTab";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BidAmountPopover } from "./BidAmountPopover";
import { Plus, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface AuctionTabsProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
  context: any;
  // Search filters props
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTeams: string[];
  setSelectedTeams: (teams: string[]) => void;
  selectedCotes: number[];
  setSelectedCotes: (cotes: number[]) => void;
  selectedCategories: string[];
  setSelectedCategories: (categories: string[]) => void;
  availableTeams: Array<{ id: string; name: string; categorie?: string }>;
  // Riders and bids
  riders: any[];
  isSearching: boolean;
  myBids: any[];
  // Handlers
  handleSubmitBid: (amount: number, riderId: string) => void;
  handleUpdateAmount: (bidId: string, coureurId: string, amount: number) => void;
  handleRemoveBid: (bidId: string) => void;
  handleSubmitAll: () => void;
  handleImportFavorites?: () => void;
  isUpdating: boolean;
  isSubmitting: boolean;
  isImportingFavorites?: boolean;
  // Sort
  sortOrder: 'nom' | 'cote';
  setSortOrder: (order: 'nom' | 'cote') => void;
  // Pagination
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export const AuctionTabs = ({
  phaseId,
  managerId,
  leagueId,
  context,
  searchQuery,
  setSearchQuery,
  selectedTeams,
  setSelectedTeams,
  selectedCotes,
  setSelectedCotes,
  selectedCategories,
  setSelectedCategories,
  availableTeams,
  riders,
  isSearching,
  myBids,
  handleSubmitBid,
  handleUpdateAmount,
  handleRemoveBid,
  handleSubmitAll,
  handleImportFavorites,
  isUpdating,
  isSubmitting,
  isImportingFavorites = false,
  sortOrder,
  setSortOrder,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: AuctionTabsProps) => {
  const { t } = useTranslation("auction");
  // Fetch closed rounds for this phase
  const { data: closedRounds = [] } = useQuery({
    queryKey: ["closed-rounds", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("auctions")
        .select("round_number, closed_at, id")
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

  return (
    <Tabs defaultValue="bid" className="w-full">
      {/* Enhanced tabs bar */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container mx-auto max-w-7xl">
          <TabsList className="w-full justify-start gap-3 bg-transparent h-16 px-4 py-2">
            <TabsTrigger 
              value="bid" 
              className="
                data-[state=active]:bg-bordure-gold 
                data-[state=active]:text-foreground 
                data-[state=active]:font-bold
                data-[state=active]:shadow-md
                data-[state=active]:border-2
                data-[state=active]:border-foreground
                data-[state=inactive]:bg-background 
                data-[state=inactive]:text-muted-foreground
                data-[state=inactive]:border-2
                data-[state=inactive]:border-border
                data-[state=inactive]:shadow-sm
                hover:bg-accent
                hover:border-bordure-gold
                dark:data-[state=inactive]:bg-card
                dark:data-[state=inactive]:text-muted-foreground
                rounded-lg 
                px-5 
                py-2.5
                text-base
                font-semibold
                transition-all
                duration-200
                cursor-pointer
              "
            >
              <Plus className="h-5 w-5 mr-2" />
              {t('tabs.bid')}
            </TabsTrigger>
            
            {/* Dynamic tabs for closed rounds */}
            {closedRounds.map((round) => (
              <TabsTrigger
                key={round.round_number}
                value={`round-${round.round_number}`}
                className="
                  data-[state=active]:bg-secondary 
                  data-[state=active]:text-bordure-gold 
                  data-[state=active]:font-bold
                  data-[state=active]:shadow-md
                  data-[state=active]:border-2
                  data-[state=active]:border-bordure-gold
                  data-[state=inactive]:bg-white 
                  data-[state=inactive]:text-gray-700
                  data-[state=inactive]:border-2
                  data-[state=inactive]:border-gray-300
                  data-[state=inactive]:shadow-sm
                  hover:bg-gray-100
                  hover:border-gray-600
                  dark:data-[state=inactive]:bg-gray-800
                  dark:data-[state=inactive]:text-foreground
                  rounded-lg 
                  px-5 
                  py-2.5
                  text-base
                  font-semibold
                  transition-all
                  duration-200
                  cursor-pointer
                "
              >
                Round {round.round_number}
              </TabsTrigger>
            ))}
            
            <TabsTrigger 
              value="teams" 
              className="
                data-[state=active]:bg-bordure-gold 
                data-[state=active]:text-foreground 
                data-[state=active]:font-bold
                data-[state=active]:shadow-md
                data-[state=active]:border-2
                data-[state=active]:border-black
                data-[state=inactive]:bg-white 
                data-[state=inactive]:text-gray-700
                data-[state=inactive]:border-2
                data-[state=inactive]:border-gray-300
                data-[state=inactive]:shadow-sm
                hover:bg-yellow-100
                hover:border-bordure-gold
                dark:data-[state=inactive]:bg-gray-800
                dark:data-[state=inactive]:text-foreground
                rounded-lg 
                px-5 
                py-2.5
                text-base
                font-semibold
                transition-all
                duration-200
                cursor-pointer
              "
            >
              {t('tabs.teams')}
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="bid" className="mt-0">
        <div className="container mx-auto max-w-7xl px-4">
          {/* Compact inline filters */}
          <div className="py-3 border-b">
            <AuctionSearchFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedTeams={selectedTeams}
              onTeamsChange={setSelectedTeams}
              selectedCotes={selectedCotes}
              onCotesChange={setSelectedCotes}
              selectedCategories={selectedCategories}
              onCategoriesChange={setSelectedCategories}
              availableTeams={availableTeams}
              onImportFavorites={handleImportFavorites}
              isImportingFavorites={isImportingFavorites}
            />
          </div>

          {/* Main content - Full height columns */}
          <div className="grid grid-cols-[2fr_1fr] gap-6 py-4 h-[calc(100vh-240px)]">
            {/* Left: Search Results - Full height */}
            <div className="flex flex-col h-full">
              <div className="mb-2 flex items-center justify-between flex-shrink-0">
                <h2 className="text-base font-semibold">{t('availableRiders')}</h2>
                <span className="text-xs text-muted-foreground">
                  {riders.length > 1 ? t('results_count_plural', { count: riders.length }) : t('results_count', { count: riders.length })}
                </span>
              </div>
              <Card className="shadow-sm flex-1 flex flex-col overflow-hidden">
                <CardContent className="p-0 flex-1 overflow-y-auto">
                  <RiderResultsList
                    riders={riders}
                    onAddRider={() => {}}
                    isLoading={isSearching}
                    onSortChange={setSortOrder}
                    currentSort={sortOrder}
                    hasMore={hasMore}
                    onLoadMore={onLoadMore}
                    isLoadingMore={isLoadingMore}
                    renderActionButton={(rider) => (
                      <BidAmountPopover
                        trigger={
                          <Button size="sm" variant="default" className="gap-1">
                            <Plus className="h-3 w-3" />
                            {t('tabs.bid')}
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
                        currency={context?.currency || ""}
                        step={context?.rules.step || 1}
                      />
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right: My Bids - Full height */}
            <div className="flex flex-col h-full">
              <div className="mb-2 flex items-center justify-between flex-shrink-0">
                <h2 className="text-base font-semibold">{t('myBids.title')}</h2>
                <span className="text-xs text-muted-foreground">
                  {myBids.length > 1 ? t('riders_count_plural', { count: myBids.length }) : t('riders_count', { count: myBids.length })}
                </span>
              </div>

              {/* Submit button BEFORE the list */}
              <div className="mb-3 space-y-2 flex-shrink-0">
                <Button
                  onClick={handleSubmitAll}
                  disabled={!context?.validation_status?.can_submit || isSubmitting}
                  size="lg"
                  className="w-full shadow-lg hover:shadow-xl transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      {t('submit.validating')}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      {t('submit.validate')}
                    </>
                  )}
                </Button>
                
                {!context?.validation_status?.can_submit && (
                  <p className="text-xs text-center text-muted-foreground">
                    {context?.validation_status?.missing_slots > 0 
                      ? (context.validation_status.missing_slots > 1 
                          ? t('missingRiders_plural', { count: context.validation_status.missing_slots })
                          : t('missingRiders', { count: context.validation_status.missing_slots }))
                      : context?.validation_status?.budget_overflow 
                        ? t('budgetExceeded')
                        : t('conditionsNotMet')}
                  </p>
                )}
              </div>
              
              <Card className="shadow-sm border-2 border-primary/20 flex-1 flex flex-col overflow-hidden">
                <CardContent className="p-0 flex-1 overflow-y-auto">
                  <MyBidsList
                    bids={myBids}
                    onUpdateAmount={handleUpdateAmount}
                    onRemove={handleRemoveBid}
                    currency={context?.currency || ""}
                    step={context?.rules.step || 1}
                    isUpdating={isUpdating}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Dynamic content for closed rounds */}
      {closedRounds.map((round) => (
        <TabsContent key={round.round_number} value={`round-${round.round_number}`} className="mt-0">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            <RoundHistoryTab
              phaseId={phaseId}
              managerId={managerId}
              leagueId={leagueId}
              roundNumber={round.round_number}
              closedAt={round.closed_at}
            />
          </div>
        </TabsContent>
      ))}

      <TabsContent value="teams" className="mt-0">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <AuctionTeamsGrid phaseId={phaseId} managerId={managerId} />
        </div>
      </TabsContent>
    </Tabs>
  );
};

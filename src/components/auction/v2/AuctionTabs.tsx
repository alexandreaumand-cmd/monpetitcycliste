import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuctionSearchFilters } from "./AuctionSearchFilters";
import { RiderResultsList } from "./RiderResultsList";
import { MyBidsList } from "./MyBidsList";
import { AuctionTeamsGrid } from "../AuctionTeamsGrid";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BidAmountPopover } from "./BidAmountPopover";
import { Plus, CheckCircle2 } from "lucide-react";

interface AuctionTabsProps {
  phaseId: string;
  managerId: string;
  context: any;
  // Search filters props
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTeams: string[];
  setSelectedTeams: (teams: string[]) => void;
  selectedCotes: number[];
  setSelectedCotes: (cotes: number[]) => void;
  availableTeams: string[];
  // Riders and bids
  riders: any[];
  isSearching: boolean;
  myBids: any[];
  // Handlers
  handleSubmitBid: (amount: number, riderId: string) => void;
  handleUpdateAmount: (bidId: string, coureurId: string, amount: number) => void;
  handleRemoveBid: (bidId: string) => void;
  handleSubmitAll: () => void;
  isUpdating: boolean;
  isSubmitting: boolean;
}

export const AuctionTabs = ({
  phaseId,
  managerId,
  context,
  searchQuery,
  setSearchQuery,
  selectedTeams,
  setSelectedTeams,
  selectedCotes,
  setSelectedCotes,
  availableTeams,
  riders,
  isSearching,
  myBids,
  handleSubmitBid,
  handleUpdateAmount,
  handleRemoveBid,
  handleSubmitAll,
  isUpdating,
  isSubmitting,
}: AuctionTabsProps) => {
  return (
    <Tabs defaultValue="bid" className="w-full">
      {/* Compact tabs bar */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl">
          <TabsList className="w-full justify-start bg-transparent h-14 px-4">
            <TabsTrigger 
              value="bid" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Enchérir
            </TabsTrigger>
            <TabsTrigger 
              value="teams" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
            >
              Équipes adverses
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
              availableTeams={availableTeams}
            />
          </div>

          {/* Main content - Equal columns */}
          <div className="grid grid-cols-2 gap-6 py-4">
            {/* Left: Search Results */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold">Coureurs disponibles</h2>
                <span className="text-xs text-muted-foreground">
                  {riders.length} résultat{riders.length > 1 ? 's' : ''}
                </span>
              </div>
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                    <RiderResultsList
                      riders={riders}
                      onAddRider={() => {}}
                      isLoading={isSearching}
                      renderActionButton={(rider) => (
                        <BidAmountPopover
                          trigger={
                            <Button size="sm" variant="default" className="gap-1">
                              <Plus className="h-3 w-3" />
                              Enchérir
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
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: My Bids */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold">Mes enchères</h2>
                <span className="text-xs text-muted-foreground">
                  {myBids.length} coureur{myBids.length > 1 ? 's' : ''}
                </span>
              </div>
              
              <Card className="shadow-sm border-2 border-primary/20">
                <CardContent className="p-0">
                  <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
                    <MyBidsList
                      bids={myBids}
                      onUpdateAmount={handleUpdateAmount}
                      onRemove={handleRemoveBid}
                      currency={context?.currency || "€"}
                      step={context?.rules.step || 1}
                      isUpdating={isUpdating}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Submit button - Always visible */}
              <div className="mt-3 space-y-2">
                <Button
                  onClick={handleSubmitAll}
                  disabled={!context?.validation_status?.can_submit || isSubmitting}
                  size="lg"
                  className="w-full shadow-lg hover:shadow-xl transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Validation en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Valider mes enchères
                    </>
                  )}
                </Button>
                
                {!context?.validation_status?.can_submit && (
                  <p className="text-xs text-center text-muted-foreground">
                    {context?.validation_status?.missing_slots > 0 
                      ? `Il manque ${context.validation_status.missing_slots} coureur${context.validation_status.missing_slots > 1 ? 's' : ''}`
                      : context?.validation_status?.budget_overflow 
                        ? "Budget dépassé" 
                        : "Conditions non remplies"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="teams" className="mt-0">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <AuctionTeamsGrid phaseId={phaseId} managerId={managerId} />
        </div>
      </TabsContent>
    </Tabs>
  );
};

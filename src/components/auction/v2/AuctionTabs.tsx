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
      <div className="border-b bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <TabsList className="w-full justify-start bg-transparent h-12">
            <TabsTrigger value="bid" className="data-[state=active]:bg-background">
              Enchérir
            </TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:bg-background">
              Équipes adverses
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="bid" className="mt-0">
        <div className="container mx-auto max-w-7xl">
          {/* Filters */}
          <div className="border-b bg-muted/30">
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

          {/* Two-column layout */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Left column: Results */}
              <div className="col-span-2">
                <Card>
                  <CardContent className="p-0 max-h-[calc(100vh-340px)] overflow-y-auto">
                    <RiderResultsList
                      riders={riders}
                      onAddRider={() => {}}
                      isLoading={isSearching}
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

              {/* Right column: My Bids + Submit button */}
              <div className="flex flex-col gap-4">
                <Card className="flex-1">
                  <CardContent className="p-0 h-[calc(100vh-280px)] overflow-y-auto">
                    <MyBidsList
                      bids={myBids}
                      onUpdateAmount={handleUpdateAmount}
                      onRemove={handleRemoveBid}
                      currency={context?.currency || "€"}
                      step={context?.rules.step || 1}
                      isUpdating={isUpdating}
                    />
                  </CardContent>
                </Card>

                {/* Submit button */}
                <Button
                  onClick={handleSubmitAll}
                  disabled={!context?.validation_status?.can_submit || isSubmitting}
                  size="lg"
                  className="w-full"
                >
                  {isSubmitting ? (
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
        </div>
      </TabsContent>

      <TabsContent value="teams" className="mt-0">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <AuctionTeamsGrid phaseId={phaseId} managerId={managerId} />
        </div>
      </TabsContent>
    </Tabs>
  );
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface AuctionCompletedViewProps {
  roster: Array<{
    coureur_id: string;
    rider_nom: string;
    rider_team: string;
    amount: number;
    round_number: number | null;
    cote: number | null;
  }>;
  budget_spent: number;
  starting_budget: number;
  currency: string;
  max_slots: number;
}

export function AuctionCompletedView({ 
  roster, 
  budget_spent, 
  starting_budget, 
  currency, 
  max_slots 
}: AuctionCompletedViewProps) {
  // Sort by round_number then by amount descending
  const sortedRoster = [...roster].sort((a, b) => {
    if (a.round_number !== b.round_number) {
      return (a.round_number || 0) - (b.round_number || 0);
    }
    return b.amount - a.amount;
  });

  const remainingBudget = starting_budget - budget_spent;

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6">
      {/* Header with badge */}
      <Card className="border-green-500/50 bg-green-500/5 mb-6">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start gap-3 mb-3">
            <CheckCircle2 className="h-7 w-7 md:h-8 md:w-8 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-bold">Enchères terminées</h1>
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20 flex-shrink-0">
                  Complet
                </Badge>
              </div>
              <p className="text-sm md:text-base text-muted-foreground">
                Tu as complété ton équipe de {max_slots} coureurs. Tes enchères sont terminées pour cette phase.
              </p>
            </div>
          </div>

          {/* Budget summary */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 mt-4 pt-4 border-t">
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Budget dépensé</p>
              <p className="text-xl md:text-2xl font-bold">{budget_spent}{currency}</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Budget restant</p>
              <p className="text-xl md:text-2xl font-bold text-muted-foreground">{remainingBudget}{currency}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg md:text-xl">Mon équipe ({roster.length} coureurs)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {sortedRoster.map((rider) => (
              <div
                key={rider.coureur_id}
                className="flex items-center justify-between p-3 md:p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="font-medium text-sm md:text-base truncate">{rider.rider_nom}</p>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">{rider.rider_team}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-sm md:text-base">{rider.amount}{currency}</p>
                  {rider.round_number && (
                    <p className="text-xs text-muted-foreground">Round {rider.round_number}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

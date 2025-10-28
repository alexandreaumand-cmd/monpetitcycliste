import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuctionTeamsGrid } from "../AuctionTeamsGrid";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";

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
  phaseId: string;
  managerId: string;
  leagueId: string | null;
}

export function AuctionCompletedView({ 
  roster, 
  budget_spent, 
  starting_budget, 
  currency, 
  max_slots,
  phaseId,
  managerId,
  leagueId
}: AuctionCompletedViewProps) {
  // Fetch validation status
  const { data: validationStatus, isLoading: validationLoading } = useQuery({
    queryKey: ['auction-validation-status', phaseId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'auction-get-validation-status',
        { body: { phase_id: phaseId, league_id: leagueId } }
      );
      if (error) throw error;
      return data as {
        validated_count: number;
        waiting_count: number;
        total_managers: number;
        validated_managers: Array<{ manager_id: string; manager_nom: string }>;
        waiting_managers: Array<{ manager_id: string; manager_nom: string }>;
      };
    },
    enabled: !!phaseId && !!leagueId,
    refetchInterval: 10000, // Refresh every 10s
  });

  // Fetch current round info
  const { data: auctionInfo } = useQuery({
    queryKey: ['auction-info', phaseId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('round_number')
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId)
        .eq('statut', 'open')
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!phaseId && !!leagueId,
  });
  // Sort by round_number then by amount descending
  const sortedRoster = [...roster].sort((a, b) => {
    if (a.round_number !== b.round_number) {
      return (a.round_number || 0) - (b.round_number || 0);
    }
    return b.amount - a.amount;
  });

  const remainingBudget = starting_budget - budget_spent;

  const currentRound = auctionInfo?.round_number || 0;

  return (
    <div className="container max-w-full mx-auto p-4 md:p-6 space-y-6">
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

      {/* Round status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            Statut du Round {currentRound}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {validationLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : validationStatus ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Managers ayant validé</p>
                <Badge variant="default" className="text-base px-3 py-1">
                  {validationStatus.validated_count} / {validationStatus.total_managers}
                </Badge>
              </div>

              {/* Validated managers */}
              {validationStatus.validated_managers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">✅ Ont validé :</p>
                  <div className="flex flex-wrap gap-2">
                    {validationStatus.validated_managers.map((mgr) => (
                      <Badge 
                        key={mgr.manager_id} 
                        variant="default"
                        className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                      >
                        {mgr.manager_nom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Waiting managers */}
              {validationStatus.waiting_managers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">⏳ En attente :</p>
                  <div className="flex flex-wrap gap-2">
                    {validationStatus.waiting_managers.map((mgr) => (
                      <Badge 
                        key={mgr.manager_id} 
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        {mgr.manager_nom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune information disponible</p>
          )}
        </CardContent>
      </Card>

      {/* Team list - NOW IN ACCORDION */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg md:text-xl">Mon équipe</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="team" className="border-none">
              <AccordionTrigger className="hover:no-underline py-2">
                <span className="text-sm text-muted-foreground">
                  Voir mes {roster.length} coureurs
                </span>
              </AccordionTrigger>
              <AccordionContent>
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Opponent teams */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            Équipes adverses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="teams" className="border-none">
              <AccordionTrigger className="hover:no-underline py-2">
                <span className="text-sm text-muted-foreground">
                  Voir les budgets et effectifs des autres managers
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-4">
                  <AuctionTeamsGrid phaseId={phaseId} managerId={managerId} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

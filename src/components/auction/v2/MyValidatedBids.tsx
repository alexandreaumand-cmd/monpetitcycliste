import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface MyValidatedBidsProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
  onBack: () => void;
}

export function MyValidatedBids({ phaseId, managerId, leagueId, onBack }: MyValidatedBidsProps) {
  const { data: bids, isLoading } = useQuery({
    queryKey: ["validated-bids", phaseId, managerId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-get-context", {
        body: { phase_id: phaseId, manager_id: managerId, league_id: leagueId },
      });
      if (error) throw error;
      
      // Get submitted bids (already filtered to pending status)
      const pendingBids = data?.submitted_bids || [];
      
      // Sort by amount descending
      return pendingBids.sort((a: any, b: any) => (b.montant || 0) - (a.montant || 0));
    },
  });

  // Get auction context for currency and budget info
  const { data: context } = useQuery({
    queryKey: ["auction-context", phaseId, managerId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-get-context", {
        body: { phase_id: phaseId, manager_id: managerId, league_id: leagueId },
      });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalAmount = bids?.reduce((sum, bid) => sum + (bid.montant || 0), 0) || 0;
  const currency = context?.currency || "€";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <CardTitle className="text-xl md:text-2xl">Mes enchères validées</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Aperçu de tes enchères soumises pour ce round
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Nombre d'enchères</p>
              <p className="text-2xl font-bold mt-1">{bids?.length || 0}</p>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Montant total</p>
              <p className="text-2xl font-bold mt-1">{totalAmount}{currency}</p>
            </div>
            {context && (
              <div className="bg-muted rounded-lg p-4 col-span-2 md:col-span-1">
                <p className="text-sm text-muted-foreground">Budget restant</p>
                <p className="text-2xl font-bold mt-1">
                  {context.totals?.remaining_budget || 0}{currency}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Bids list */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Liste des coureurs
            </h3>
            
            {!bids || bids.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune enchère validée
              </div>
            ) : (
              <div className="space-y-2">
                {bids.map((bid: any) => {
                  const cote = bid.cote;

                  return (
                    <Card key={bid.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          {/* Rider info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold truncate">{bid.nom || "N/A"}</p>
                              <Badge variant="outline" className="shrink-0">
                                <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                                Validé
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <span className="truncate">{bid.equipe || "N/A"}</span>
                              {cote && (
                                <>
                                  <span>•</span>
                                  <span>Cote {cote}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold">
                              {bid.montant}{currency}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              💡 Ces enchères sont en attente de traitement. Tu ne peux plus les modifier.
              Le round se clôturera automatiquement à la deadline.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

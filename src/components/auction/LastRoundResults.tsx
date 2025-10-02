import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, AlertCircle, Trophy } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface LastRoundResultsProps {
  phaseId: string;
  managerId: string;
}

export const LastRoundResults = ({ phaseId, managerId }: LastRoundResultsProps) => {
  const [isOpen, setIsOpen] = useState(true);

  // Get last closed auction
  const { data: lastAuction } = useQuery({
    queryKey: ['last-closed-auction', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('last_closed_auction')
        .select('*')
        .eq('phase_id', phaseId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  // Get my last round bids
  const { data: myBids = [] } = useQuery({
    queryKey: ['my-last-round-bids', phaseId, managerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('my_last_round_bids')
        .select('*')
        .eq('phase_id', phaseId)
        .eq('manager_id', managerId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!lastAuction
  });

  // Get last round winners
  const { data: winners = [] } = useQuery({
    queryKey: ['last-round-winners', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('last_round_winners')
        .select('*')
        .eq('phase_id', phaseId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!lastAuction
  });

  if (!lastAuction) {
    return null;
  }

  const wonBids = myBids.filter(b => b.outcome === 'won');
  const lostBids = myBids.filter(b => b.outcome === 'lost');
  const carriedBids = myBids.filter(b => b.outcome === 'carried_over');

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-base flex items-center justify-between">
              <span>
                Dernier round clos · Round {lastAuction.round_number}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-normal">
                  {format(new Date(lastAuction.closed_at), "PPP", { locale: fr })}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent>
            <Tabs defaultValue="my-bids">
              <TabsList className="w-full">
                <TabsTrigger value="my-bids" className="flex-1">
                  Mes enchères
                  <Badge variant="outline" className="ml-2">
                    {wonBids.length}🟢 · {lostBids.length}🔴 · {carriedBids.length}🟨
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="winners" className="flex-1">
                  Gagnants
                  <Badge variant="outline" className="ml-2">
                    {winners.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="my-bids" className="mt-4 space-y-4">
                {wonBids.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Gagnées ({wonBids.length})
                    </h4>
                    <div className="space-y-1">
                      {wonBids.map((bid) => (
                        <div key={bid.bid_id} className="p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{bid.coureur_nom}</span>
                            <span className="text-green-700 dark:text-green-400">
                              {parseFloat(bid.my_bid.toString()).toFixed(0)} €
                            </span>
                          </div>
                          {bid.coureur_equipe && (
                            <span className="text-xs text-muted-foreground">{bid.coureur_equipe}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lostBids.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Perdues ({lostBids.length})
                    </h4>
                    <div className="space-y-1">
                      {lostBids.map((bid) => (
                        <div key={bid.bid_id} className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{bid.coureur_nom}</span>
                            <span className="text-red-700 dark:text-red-400">
                              {parseFloat(bid.my_bid.toString()).toFixed(0)} €
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Perdu contre {bid.winning_manager} à {parseFloat(bid.winning_amount?.toString() || '0').toFixed(0)} €
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {carriedBids.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      Égalités ({carriedBids.length})
                    </h4>
                    <div className="space-y-1">
                      {carriedBids.map((bid) => (
                        <div key={bid.bid_id} className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{bid.coureur_nom}</span>
                            <span className="text-orange-700 dark:text-orange-400">
                              {parseFloat(bid.my_bid.toString()).toFixed(0)} €
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Ex æquo · Repart au prochain round
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {myBids.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune enchère pour ce round
                  </p>
                )}
              </TabsContent>

              <TabsContent value="winners" className="mt-4">
                <div className="space-y-1">
                  {winners.map((winner, idx) => (
                    <div key={idx} className="p-2 bg-muted/50 rounded text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-3 w-3 text-yellow-600" />
                        <div>
                          <p className="font-medium">{winner.coureur_nom}</p>
                          <p className="text-xs text-muted-foreground">{winner.coureur_equipe}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{winner.manager_gagnant}</p>
                        <p className="text-xs text-muted-foreground">
                          {parseFloat(winner.montant_gagnant.toString()).toFixed(0)} €
                        </p>
                      </div>
                    </div>
                  ))}
                  {winners.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucun gagnant pour ce round
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

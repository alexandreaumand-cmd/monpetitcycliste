import { AuctionBidForm } from "./AuctionBidForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatAmount } from "@/lib/utils";

interface BidFormWithHelpProps {
  auction: {
    id: string;
    round_number: number;
    phase_id: string;
    deadline_at: string;
  };
  managerId: string;
}

export const BidFormWithHelp = ({ auction, managerId }: BidFormWithHelpProps) => {
  // Get lost bids from previous round
  const { data: lostBids = [] } = useQuery({
    queryKey: ['lost-bids-previous', managerId, auction.phase_id, auction.round_number],
    queryFn: async () => {
      if (auction.round_number <= 1) return [];

      const { data, error } = await supabase
        .from('bids_outcomes')
        .select('*')
        .eq('manager_id', managerId)
        .eq('phase_id', auction.phase_id)
        .eq('round_number', auction.round_number - 1)
        .in('outcome', ['lost', 'carried_over'])
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: auction.round_number > 1
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Main form */}
      <div>
        <AuctionBidForm auction={auction} managerId={managerId} />
      </div>

      {/* Help sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Aide à la décision
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription className="text-sm space-y-2">
                <p className="font-medium">Règles de validation :</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Offre ≥ prix initial du coureur</li>
                  <li>Décimales autorisées (ex: 125.50 €)</li>
                  <li>Somme totale = budget restant</li>
                  <li>Nombre d'enchères = slots restants</li>
                  <li>Pas de doublons</li>
                </ul>
              </AlertDescription>
            </Alert>

            {lostBids.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Conflits précédents
                </p>
                <div className="space-y-2">
                  {lostBids.map((bid) => (
                    <div key={bid.bid_id} className="p-2 bg-muted rounded text-xs">
                      <p className="font-medium">{bid.coureur_nom}</p>
                      <p className="text-muted-foreground">
                        {bid.outcome === 'lost' ? (
                          <>Perdu contre {bid.winning_manager} à {formatAmount(bid.winning_amount)}</>
                        ) : (
                          <>Ex æquo à {formatAmount(bid.my_bid)}</>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
                <Badge variant="outline" className="w-full justify-center text-xs">
                  {lostBids.length} conflit(s) Round {auction.round_number - 1}
                </Badge>
              </div>
            )}

            <div className="p-3 bg-muted/30 rounded-lg text-xs space-y-2">
              <p className="font-medium">💡 Astuces :</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Les brouillons sont autosavés</li>
                <li>• Ctrl/Cmd + K : Vue rapide</li>
                <li>• Coureurs pris = grisés</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

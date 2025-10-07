import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { formatAmount } from "@/lib/utils";

interface BidHistoryProps {
  managerId: string;
  phaseId: string;
}

export const BidHistory = ({ managerId, phaseId }: BidHistoryProps) => {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // Get closed rounds for this phase
  const { data: closedRounds = [], isLoading: loadingRounds } = useQuery({
    queryKey: ['closed-rounds', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('round_number')
        .eq('phase_id', phaseId)
        .eq('statut', 'closed')
        .order('round_number', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // Get bid outcomes for selected round
  const { data: outcomes = [], isLoading: loadingOutcomes } = useQuery({
    queryKey: ['bid-outcomes', managerId, phaseId, selectedRound],
    queryFn: async () => {
      if (!selectedRound) return [];

      const { data, error } = await supabase
        .from('bids_outcomes')
        .select('*')
        .eq('manager_id', managerId)
        .eq('phase_id', phaseId)
        .eq('round_number', selectedRound)
        .order('coureur_nom');

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRound
  });

  // Set initial round when data loads
  if (closedRounds.length > 0 && !selectedRound) {
    setSelectedRound(closedRounds[0].round_number);
  }

  const won = outcomes.filter(o => o.outcome === 'won');
  const lost = outcomes.filter(o => o.outcome === 'lost');
  const carriedOver = outcomes.filter(o => o.outcome === 'carried_over');

  if (loadingRounds) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des enchères</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (closedRounds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des enchères</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Aucun round clôturé pour le moment</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Historique des enchères</span>
          <Select value={selectedRound?.toString() || ""} onValueChange={(v) => setSelectedRound(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sélectionner un round" />
            </SelectTrigger>
            <SelectContent>
              {closedRounds.map((round) => (
                <SelectItem key={round.round_number} value={round.round_number.toString()}>
                  Round {round.round_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loadingOutcomes ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Badge variant="default" className="flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Gagnées: {won.length}
              </Badge>
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Perdues: {lost.length}
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Égalités: {carriedOver.length}
              </Badge>
            </div>

            <Tabs defaultValue="won" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="won">Gagnées ({won.length})</TabsTrigger>
                <TabsTrigger value="lost">Perdues ({lost.length})</TabsTrigger>
                <TabsTrigger value="carried_over">Égalités ({carriedOver.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="won" className="space-y-2 mt-4">
                {won.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Aucune enchère gagnée</p>
                ) : (
                  won.map((bid) => (
                    <div key={bid.bid_id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                      <div>
                        <p className="font-medium">{bid.coureur_nom}</p>
                        <p className="text-sm text-muted-foreground">{bid.coureur_equipe}</p>
                      </div>
                      <Badge variant="outline" className="text-green-700 dark:text-green-400">
                        {formatAmount(bid.my_bid)}
                      </Badge>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="lost" className="space-y-2 mt-4">
                {lost.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Aucune enchère perdue</p>
                ) : (
                  lost.map((bid) => (
                    <div key={bid.bid_id} className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{bid.coureur_nom}</p>
                        <Badge variant="outline" className="text-red-700 dark:text-red-400">
                          {formatAmount(bid.my_bid)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {bid.coureur_equipe}
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                        Perdu contre <strong>{bid.winning_manager}</strong> à {formatAmount(bid.winning_amount)}
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="carried_over" className="space-y-2 mt-4">
                {carriedOver.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Aucune égalité</p>
                ) : (
                  carriedOver.map((bid) => (
                    <div key={bid.bid_id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                      <div>
                        <p className="font-medium">{bid.coureur_nom}</p>
                        <p className="text-sm text-muted-foreground">{bid.coureur_equipe}</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                          Ex æquo — repart au prochain round
                        </p>
                      </div>
                      <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400">
                        {formatAmount(bid.my_bid)}
                      </Badge>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

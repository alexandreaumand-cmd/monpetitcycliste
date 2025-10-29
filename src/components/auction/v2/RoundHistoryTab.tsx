import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, XCircle, AlertCircle } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface RoundHistoryTabProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
  roundNumber: number;
  closedAt: string;
}

export function RoundHistoryTab({
  phaseId,
  managerId,
  leagueId,
  roundNumber,
  closedAt,
}: RoundHistoryTabProps) {
  // Get bid outcomes for this round
  const { data: outcomes = [], isLoading } = useQuery({
    queryKey: ["round-history", phaseId, managerId, leagueId, roundNumber],
    queryFn: async () => {
      let query = supabase
        .from("bids_outcomes")
        .select("*")
        .eq("manager_id", managerId)
        .eq("phase_id", phaseId)
        .eq("round_number", roundNumber);

      // Filter by league_id to avoid mixing data from different leagues
      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }

      const { data, error } = await query.order("coureur_nom");
      if (error) throw error;
      return data || [];
    },
  });

  const won = outcomes.filter((o) => o.outcome === "won");
  const lost = outcomes.filter((o) => o.outcome === "lost");
  const carriedOver = outcomes.filter((o) => o.outcome === "carried_over");

  // Get losers (beaten managers) for each won rider
  const { data: losersData = [] } = useQuery({
    queryKey: ["round-losers", phaseId, leagueId, roundNumber, won.map(w => w.coureur_id)],
    queryFn: async () => {
      if (won.length === 0) return [];
      
      const coureurIds = won.map(w => w.coureur_id);
      
      let query = supabase
        .from("bids_outcomes")
        .select("coureur_id, my_bid, winning_manager")
        .eq("phase_id", phaseId)
        .eq("round_number", roundNumber)
        .eq("outcome", "lost")
        .in("coureur_id", coureurIds);
      
      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: won.length > 0,
  });

  // Group losers by coureur_id
  const losersByRider = losersData.reduce((acc, loser) => {
    if (!acc[loser.coureur_id!]) {
      acc[loser.coureur_id!] = [];
    }
    acc[loser.coureur_id!].push({
      nom: loser.winning_manager || 'Inconnu',
      montant: loser.my_bid!
    });
    return acc;
  }, {} as Record<string, Array<{ nom: string; montant: number }>>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with KPIs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold">Round {roundNumber}</h2>
              <p className="text-sm text-muted-foreground">
                Clôturé le {format(new Date(closedAt), "PPP", { locale: fr })}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Badge variant="default" className="flex items-center gap-1.5 px-3 py-1.5">
                <Trophy className="h-4 w-4" />
                {won.length} gagnée{won.length > 1 ? "s" : ""}
              </Badge>
              <Badge variant="destructive" className="flex items-center gap-1.5 px-3 py-1.5">
                <XCircle className="h-4 w-4" />
                {lost.length} perdue{lost.length > 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5">
                <AlertCircle className="h-4 w-4" />
                {carriedOver.length} égalité{carriedOver.length > 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Grid 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Won */}
        <Card className="bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
              <Trophy className="h-5 w-5" />
              Gagnées ({won.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {won.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune enchère gagnée
              </p>
            ) : (
              won.map((bid) => {
                const beatManagers = losersByRider[bid.coureur_id!] || [];
                
                return (
                  <div
                    key={bid.bid_id}
                    className="p-3 bg-background rounded-lg border shadow-sm"
                  >
                    <p className="font-semibold text-sm">{bid.coureur_nom}</p>
                    <p className="text-xs text-muted-foreground">{bid.coureur_equipe}</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                      {formatAmount(bid.my_bid)}
                    </p>
                    {beatManagers.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tu bats :
                        </p>
                        {beatManagers.map((loser, idx) => (
                          <p key={idx} className="text-xs font-medium text-green-700 dark:text-green-400">
                            {loser.nom} à {formatAmount(loser.montant)}
                          </p>
                        ))}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Lost */}
        <Card className="bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              Perdues ({lost.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lost.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune enchère perdue
              </p>
            ) : (
              lost.map((bid) => (
                <div
                  key={bid.bid_id}
                  className="p-3 bg-background rounded-lg border shadow-sm"
                >
                  <p className="font-semibold text-sm">{bid.coureur_nom}</p>
                  <p className="text-xs text-muted-foreground">{bid.coureur_equipe}</p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">
                    {formatAmount(bid.my_bid)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contre <strong>{bid.winning_manager}</strong>
                  </p>
                  <p className="text-xs font-medium text-red-700 dark:text-red-400">
                    à {formatAmount(bid.winning_amount)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Carried Over */}
        <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
              Égalités ({carriedOver.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {carriedOver.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune égalité
              </p>
            ) : (
              carriedOver.map((bid) => (
                <div
                  key={bid.bid_id}
                  className="p-3 bg-background rounded-lg border shadow-sm"
                >
                  <p className="font-semibold text-sm">{bid.coureur_nom}</p>
                  <p className="text-xs text-muted-foreground">{bid.coureur_equipe}</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400 mt-1">
                    {formatAmount(bid.my_bid)}
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                    Ex æquo — repart au prochain round
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

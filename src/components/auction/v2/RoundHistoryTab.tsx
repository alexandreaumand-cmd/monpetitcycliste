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
      {/* Enhanced Header */}
      <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-xl px-5 py-2 bg-primary">
                  Round {roundNumber}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span>Clôturé le {format(new Date(closedAt), "PPP", { locale: fr })}</span>
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="text-center px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                <Trophy className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{won.length}</p>
                <p className="text-xs text-muted-foreground">Gagnée{won.length > 1 ? "s" : ""}</p>
              </div>
              <div className="text-center px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{lost.length}</p>
                <p className="text-xs text-muted-foreground">Perdue{lost.length > 1 ? "s" : ""}</p>
              </div>
              <div className="text-center px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{carriedOver.length}</p>
                <p className="text-xs text-muted-foreground">Égalité{carriedOver.length > 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Grid 3 columns with enhanced cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Won */}
        <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-background border-green-500/30 hover:border-green-500/50 transition-all">
          <CardHeader className="pb-4 border-b border-green-500/20">
            <CardTitle className="text-xl flex items-center gap-2 text-green-700 dark:text-green-400">
              <Trophy className="h-6 w-6" />
              Gagnées ({won.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {won.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune enchère gagnée
              </p>
            ) : (
              won.map((bid, idx) => {
                const beatManagers = losersByRider[bid.coureur_id!] || [];
                
                return (
                  <Card
                    key={bid.bid_id}
                    className="hover-scale bg-background/80 border-green-500/20 animate-fade-in"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div>
                          <p className="font-bold text-base">{bid.coureur_nom}</p>
                          <p className="text-xs text-muted-foreground">{bid.coureur_equipe}</p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-green-500/20">
                          <span className="text-xl font-bold text-green-600 dark:text-green-400">
                            {formatAmount(bid.my_bid)}
                          </span>
                          <Badge variant="outline" className="bg-green-500/10 border-green-500/30">
                            ✓ Gagné
                          </Badge>
                        </div>
                        {beatManagers.length > 0 && (
                          <div className="pt-2 border-t border-green-500/10">
                            <p className="text-xs text-muted-foreground mb-1">Tu bats :</p>
                            <div className="space-y-1">
                              {beatManagers.map((loser, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="font-medium">{loser.nom}</span>
                                  <span className="text-muted-foreground">{formatAmount(loser.montant)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Lost */}
        <Card className="bg-gradient-to-br from-red-500/10 via-red-500/5 to-background border-red-500/30 hover:border-red-500/50 transition-all">
          <CardHeader className="pb-4 border-b border-red-500/20">
            <CardTitle className="text-xl flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="h-6 w-6" />
              Perdues ({lost.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {lost.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune enchère perdue
              </p>
            ) : (
              lost.map((bid, idx) => (
                <Card
                  key={bid.bid_id}
                  className="hover-scale bg-background/80 border-red-500/20 animate-fade-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div>
                        <p className="font-bold text-base">{bid.coureur_nom}</p>
                        <p className="text-xs text-muted-foreground">{bid.coureur_equipe}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-red-500/20">
                        <span className="text-xl font-bold text-red-600 dark:text-red-400">
                          {formatAmount(bid.my_bid)}
                        </span>
                        <Badge variant="outline" className="bg-red-500/10 border-red-500/30">
                          ✗ Perdu
                        </Badge>
                      </div>
                      <div className="pt-2 border-t border-red-500/10 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Contre</span>
                          <span className="font-medium">{bid.winning_manager}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Enchère gagnante</span>
                          <span className="font-bold text-red-700 dark:text-red-400">
                            {formatAmount(bid.winning_amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Carried Over */}
        <Card className="bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-background border-orange-500/30 hover:border-orange-500/50 transition-all">
          <CardHeader className="pb-4 border-b border-orange-500/20">
            <CardTitle className="text-xl flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertCircle className="h-6 w-6" />
              Égalités ({carriedOver.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {carriedOver.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune égalité
              </p>
            ) : (
              carriedOver.map((bid, idx) => (
                <Card
                  key={bid.bid_id}
                  className="hover-scale bg-background/80 border-orange-500/20 animate-fade-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div>
                        <p className="font-bold text-base">{bid.coureur_nom}</p>
                        <p className="text-xs text-muted-foreground">{bid.coureur_equipe}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-orange-500/20">
                        <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                          {formatAmount(bid.my_bid)}
                        </span>
                        <Badge variant="outline" className="bg-orange-500/10 border-orange-500/30">
                          = Égalité
                        </Badge>
                      </div>
                      <p className="text-xs text-orange-700 dark:text-orange-400 pt-2 border-t border-orange-500/10">
                        Ex æquo — repart au prochain round
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

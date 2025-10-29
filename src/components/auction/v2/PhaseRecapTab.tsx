import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, TrendingUp, Users, DollarSign, Target, Award } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PhaseRecapTabProps {
  phaseId: string;
  leagueId: string | null;
}

export function PhaseRecapTab({ phaseId, leagueId }: PhaseRecapTabProps) {
  // Fetch all bids outcomes for KPIs
  const { data: allBids = [], isLoading: bidsLoading } = useQuery({
    queryKey: ["phase-all-bids", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("bids_outcomes")
        .select("*")
        .eq("phase_id", phaseId);

      if (leagueId) query = query.eq("league_id", leagueId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch timeline from annonces  (using bids_outcomes instead since annonces doesn't have rider names)
  const { data: timelineRaw = [], isLoading: timelineLoading } = useQuery({
    queryKey: ["phase-timeline", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("bids_outcomes")
        .select("*")
        .eq("phase_id", phaseId)
        .eq("outcome", "won")
        .order("round_number", { ascending: true });

      if (leagueId) query = query.eq("league_id", leagueId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Transform to timeline format
  const timeline = timelineRaw.map(item => ({
    round_number: item.round_number,
    coureur_id: item.coureur_id,
    coureur_nom: item.coureur_nom,
    coureur_equipe: item.coureur_equipe,
    winning_amount: item.winning_amount,
    winning_manager: item.winning_manager,
    created_at: null,
  }));

  if (bidsLoading || timelineLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate KPIs
  const totalBids = allBids.length;
  const wonBids = allBids.filter((b) => b.outcome === "won");
  const lostBids = allBids.filter((b) => b.outcome === "lost");
  const totalSpent = wonBids.reduce((sum, b) => sum + (b.winning_amount || 0), 0);
  const avgSpent = wonBids.length > 0 ? totalSpent / wonBids.length : 0;
  const highestBid = Math.max(...allBids.map((b) => b.winning_amount || 0), 0);
  const uniqueRiders = new Set(allBids.map((b) => b.coureur_id)).size;
  const totalRounds = new Set(allBids.map((b) => b.round_number)).size;
  const successRate = totalBids > 0 ? (wonBids.length / totalBids) * 100 : 0;

  // Find most active manager
  const managerBidCounts = allBids.reduce((acc, bid) => {
    const manager = bid.winning_manager || "Inconnu";
    acc[manager] = (acc[manager] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostActiveManager = Object.entries(managerBidCounts).sort(([, a], [, b]) => b - a)[0];

  // Find most competitive round (most bids)
  const roundBidCounts = allBids.reduce((acc, bid) => {
    acc[bid.round_number] = (acc[bid.round_number] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const mostCompetitiveRound = Object.entries(roundBidCounts).sort(([, a], [, b]) => b - a)[0];

  // Find highest bid details
  const highestBidDetails = allBids.find((b) => b.winning_amount === highestBid);

  // Group timeline by round
  const timelineByRound = timeline.reduce((acc, item) => {
    if (!acc[item.round_number]) {
      acc[item.round_number] = [];
    }
    acc[item.round_number].push(item);
    return acc;
  }, {} as Record<number, typeof timeline>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">📊 Récapitulatif de la Phase</CardTitle>
        </CardHeader>
      </Card>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Rounds Totaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalRounds}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Budget Moyen Dépensé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatAmount(avgSpent)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Coureurs Différents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{uniqueRiders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Taux de Réussite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{successRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {wonBids.length} gagnées / {totalBids} tentées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Enchère la Plus Élevée
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatAmount(highestBid)}</p>
            {highestBidDetails && (
              <p className="text-xs text-muted-foreground mt-1">
                {highestBidDetails.coureur_nom} ({highestBidDetails.winning_manager})
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Manager le Plus Actif
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mostActiveManager ? (
              <>
                <p className="text-2xl font-bold">{mostActiveManager[0]}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {mostActiveManager[1]} enchères
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">N/A</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">🏆 Timeline des Enchères Gagnées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(timelineByRound)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([roundNum, items]) => (
              <div key={roundNum}>
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    Round {roundNum}
                  </Badge>
                  {items[0]?.created_at && (
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(items[0].created_at), "PPP", { locale: fr })}
                    </span>
                  )}
                </div>
                <div className="space-y-2 pl-6 border-l-2 border-primary/20">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-3">
                      <div className="flex-1">
                        <p className="font-semibold">
                          {item.coureur_nom}
                          <span className="text-muted-foreground font-normal text-sm ml-2">
                            {item.coureur_equipe}
                          </span>
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm">
                          <span className="font-bold text-primary">
                            {formatAmount(item.winning_amount)}
                          </span>
                          <span className="text-muted-foreground">
                            {item.winning_manager}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

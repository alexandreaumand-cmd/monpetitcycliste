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
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-background border-primary/30 hover-scale">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Rounds Totaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold text-primary">{totalRounds}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/15 via-primary/5 to-background border-primary/20 hover-scale">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Budget Moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{formatAmount(avgSpent)}</p>
            <p className="text-xs text-muted-foreground mt-1">par acquisition</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/15 via-primary/5 to-background border-primary/20 hover-scale">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Taux de Réussite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">{successRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {wonBids.length} / {totalBids} enchères
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-scale transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Coureurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{uniqueRiders}</p>
          </CardContent>
        </Card>

        <Card className="hover-scale transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Enchère Max
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatAmount(highestBid)}</p>
            {highestBidDetails && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {highestBidDetails.coureur_nom}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="hover-scale transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Plus Actif
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mostActiveManager ? (
              <>
                <p className="text-lg font-bold truncate">{mostActiveManager[0]}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {mostActiveManager[1]} enchères
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">N/A</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline - Vertical with visual indicators */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-background border-b">
          <CardTitle className="text-2xl flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            Timeline des Acquisitions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="relative space-y-8">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-primary/20" />
            
            {Object.entries(timelineByRound)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([roundNum, items], roundIdx) => (
                <div key={roundNum} className="relative pl-12 animate-fade-in" style={{ animationDelay: `${roundIdx * 100}ms` }}>
                  {/* Round badge indicator */}
                  <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-primary border-4 border-background flex items-center justify-center shadow-lg">
                    <span className="text-xs font-bold text-primary-foreground">{roundNum}</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-base px-4 py-1 bg-primary/20 border-primary/30">
                        Round {roundNum}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {items.length} acquisition{items.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map((item, idx) => (
                        <Card key={idx} className="hover-scale bg-gradient-to-br from-card to-card/50">
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <div>
                                <p className="font-bold text-base">{item.coureur_nom}</p>
                                <p className="text-xs text-muted-foreground">{item.coureur_equipe}</p>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-lg font-bold text-primary">
                                  {formatAmount(item.winning_amount)}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {item.winning_manager}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

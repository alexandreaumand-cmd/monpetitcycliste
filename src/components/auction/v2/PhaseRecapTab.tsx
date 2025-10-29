import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, TrendingUp, TrendingDown, ThumbsDown, Zap } from "lucide-react";
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
      .select("*, managers!inner(nom)")
      .eq("phase_id", phaseId);

      if (leagueId) query = query.eq("league_id", leagueId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch completion speed
  const { data: completionData = [], isLoading: completionLoading } = useQuery({
    queryKey: ["phase-completion-speed", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("bids_outcomes")
        .select("winning_manager, round_number")
        .eq("phase_id", phaseId)
        .eq("outcome", "won");

      if (leagueId) query = query.eq("league_id", leagueId);

      const { data, error } = await query;
      if (error) throw error;

      // Group by manager and find max round
      const managerCompletion = (data || []).reduce((acc, bid) => {
        const manager = bid.winning_manager;
        if (!manager) return acc;
        acc[manager] = Math.max(acc[manager] || 0, bid.round_number);
        return acc;
      }, {} as Record<string, number>);

      // Sort by round ascending (fastest = lowest round)
      return Object.entries(managerCompletion)
        .sort(([, a], [, b]) => a - b)
        .slice(0, 3); // Top 3
    },
  });

  if (bidsLoading || completionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate KPIs
  // 1. Manager qui a perdu le plus d'enchères
  const managerLostCounts = allBids
    .filter((b) => b.outcome === "lost")
    .reduce((acc, bid) => {
      const manager = bid.managers?.nom || "Inconnu";
      acc[manager] = (acc[manager] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  const biggestLoser = Object.entries(managerLostCounts).sort(([, a], [, b]) => b - a)[0];

  // 2. Enchère Max
  const highestBid = Math.max(...allBids.map((b) => b.winning_amount || 0), 0);
  const highestBidDetails = allBids.find((b) => b.winning_amount === highestBid);

  // 3. Top 10 gains serrés
  const closeCalls = allBids
    .filter((b) => b.outcome === "lost" && b.my_bid && b.winning_amount)
    .map((b) => ({
      ...b,
      diff_percent: ((Number(b.winning_amount) - Number(b.my_bid)) / Number(b.winning_amount)) * 100,
    }))
    .sort((a, b) => a.diff_percent - b.diff_percent)
    .slice(0, 10);

  // 4. Loser du Tour 1 (enchères perdues au tour 1)
  const round1Losses = allBids
    .filter((b) => b.round_number === 1 && b.outcome === "lost")
    .reduce((acc, bid) => {
      const manager = bid.managers?.nom || "Inconnu";
      acc[manager] = (acc[manager] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const round1Loser = Object.entries(round1Losses).sort(([, a], [, b]) => b - a)[0]; // max de pertes

  // 5. Roi du Tour 1 (victoires au tour 1)
  const round1Wins = allBids
    .filter((b) => b.round_number === 1 && b.outcome === "won")
    .reduce((acc, bid) => {
      const manager = bid.winning_manager || "Inconnu";
      acc[manager] = (acc[manager] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const round1King = Object.entries(round1Wins).sort(([, a], [, b]) => b - a)[0]; // max de victoires

  return (
    <div className="space-y-6">
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Manager qui a perdu le plus */}
        <Card className="bg-gradient-to-br from-red-500/20 via-red-500/10 to-background border-red-500/30 hover-scale">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Plus grand perdant
            </CardTitle>
          </CardHeader>
          <CardContent>
            {biggestLoser ? (
              <>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 truncate">
                  {biggestLoser[0]}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {biggestLoser[1]} enchères perdues
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">N/A</p>
            )}
          </CardContent>
        </Card>

        {/* Enchère Max */}
        <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-background border-primary/30 hover-scale">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Enchère Max
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">{formatAmount(highestBid)}</p>
            {highestBidDetails && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {highestBidDetails.coureur_nom}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Roi du Tour 1 */}
        <Card className="bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-background border-amber-500/30 hover-scale">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              Roi du Tour 1
            </CardTitle>
          </CardHeader>
          <CardContent>
            {round1King ? (
              <>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 truncate">
                  {round1King[0]}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {round1King[1]} victoire{round1King[1] > 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">N/A</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Loser du Tour 1 */}
        <Card className="hover-scale transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ThumbsDown className="h-4 w-4" />
              Loser du Tour 1
            </CardTitle>
          </CardHeader>
          <CardContent>
            {round1Loser ? (
              <>
                <p className="text-2xl font-bold truncate">{round1Loser[0]}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {round1Loser[1]} raté{round1Loser[1] > 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">N/A</p>
            )}
          </CardContent>
        </Card>

        {/* Rapidité de clôture */}
        <Card className="hover-scale transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Les plus rapides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {completionData.length > 0 ? (
                completionData.map(([manager, round], idx) => (
                  <div key={manager} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <Badge variant="outline" className="w-5 h-5 p-0 flex items-center justify-center">
                        {idx + 1}
                      </Badge>
                      <span className="truncate max-w-[120px]">{manager}</span>
                    </span>
                    <span className="text-muted-foreground">Round {round}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-xs">Aucune donnée</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau "Qui a le seum ?" */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <span>😤 Qui a le seum ?</span>
            <Badge variant="secondary" className="text-xs">
              Les plus gros loupés
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {closeCalls.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Manager</th>
                    <th className="text-left p-2">Coureur</th>
                    <th className="text-right p-2">Enchère</th>
                    <th className="text-right p-2">Enchère gagnante</th>
                    <th className="text-right p-2">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {closeCalls.map((call, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                <td className="p-2 truncate max-w-[100px]">
                  {call.managers?.nom || "Inconnu"}
                </td>
                      <td className="p-2 truncate max-w-[120px]">{call.coureur_nom}</td>
                      <td className="p-2 text-right font-mono">{formatAmount(call.my_bid)}</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {formatAmount(call.winning_amount)}
                      </td>
                      <td className="p-2 text-right">
                        <Badge variant={call.diff_percent < 5 ? "destructive" : "secondary"}>
                          {call.diff_percent.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">
              Aucune enchère perdue à afficher
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

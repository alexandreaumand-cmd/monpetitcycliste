import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, TrendingUp, TrendingDown, ThumbsDown, Zap, Swords, Info } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhaseRecapTabProps {
  phaseId: string;
  leagueId: string | null;
}

interface ManagerBattleStats {
  nom: string;
  totalBids: number;
  soloBids: number;
  battlesEntered: number;
  battlesLost: number;
  pctSolo: number;
  pctBattleLoss: number;
}

interface Rivalry {
  managers: string[];
  count: number;
}

export function PhaseRecapTab({ phaseId, leagueId }: PhaseRecapTabProps) {
  const { t } = useTranslation("auction");
  const [selectedManager, setSelectedManager] = useState<ManagerBattleStats | null>(null);

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
      // Deduplicate by bid_id to prevent display duplicates from cache/phase mixing
      const raw = data || [];
      return raw.filter(
        (b: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.bid_id === b.bid_id) === idx
      );
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

  // Battle statistics
  const { data: battleStats, isLoading: battleStatsLoading } = useQuery({
    queryKey: ["phase-battle-stats", phaseId, leagueId],
    queryFn: async () => {
      // Grouper par round + coureur pour identifier les batailles
      const battles = allBids.reduce((acc, bid) => {
        const key = `${bid.round_number}-${bid.coureur_id}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(bid);
        return acc;
      }, {} as Record<string, typeof allBids>);

      // Calcul des stats par manager
      const managerStats: Record<string, {
        nom: string;
        totalBids: number;
        soloBids: number;
        battlesEntered: number;
        battlesLost: number;
      }> = {};

      // Calcul des rivalités (paires de managers)
      const rivalries: Record<string, { managers: string[]; count: number }> = {};

      Object.values(battles).forEach((bidsOnRider) => {
        const isBattle = bidsOnRider.length > 1;
        
        bidsOnRider.forEach((bid) => {
          const managerId = bid.manager_id;
          const managerNom = bid.managers?.nom || "Inconnu";
          
          if (!managerStats[managerId]) {
            managerStats[managerId] = {
              nom: managerNom,
              totalBids: 0,
              soloBids: 0,
              battlesEntered: 0,
              battlesLost: 0
            };
          }
          
          managerStats[managerId].totalBids++;
          
          if (isBattle) {
            managerStats[managerId].battlesEntered++;
            if (bid.outcome === 'lost') {
              managerStats[managerId].battlesLost++;
            }
          } else {
            managerStats[managerId].soloBids++;
          }
        });

        // Compter les rivalités (batailles avec participants uniques)
        if (isBattle) {
          const managerNames = [...new Set(bidsOnRider.map(b => b.managers?.nom || "Inconnu"))].sort();
          // Pour chaque paire de managers dans cette bataille
          for (let i = 0; i < managerNames.length; i++) {
            for (let j = i + 1; j < managerNames.length; j++) {
              const key = `${managerNames[i]}-${managerNames[j]}`;
              if (!rivalries[key]) {
                rivalries[key] = { managers: [managerNames[i], managerNames[j]], count: 0 };
              }
              rivalries[key].count++;
            }
          }
        }
      });

      // Calculer les pourcentages
      const managers: ManagerBattleStats[] = Object.values(managerStats).map(m => ({
        ...m,
        pctSolo: m.totalBids > 0 ? Math.round(m.soloBids / m.totalBids * 100) : 0,
        pctBattleLoss: m.battlesEntered > 0 ? Math.round(m.battlesLost / m.battlesEntered * 100) : 0
      }));

      return {
        managers: managers.sort((a, b) => b.battlesEntered - a.battlesEntered),
        topRivalries: Object.values(rivalries)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5) as Rivalry[]
      };
    },
    enabled: allBids.length > 0,
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

  // 3. Top 10 gains serrés (dédupliqué par coureur)
  const closeCallsRaw = allBids
    .filter((b) => b.outcome === "lost" && b.my_bid && b.winning_amount)
    .map((b) => ({
      ...b,
      diff_percent: ((Number(b.winning_amount) - Number(b.my_bid)) / Number(b.winning_amount)) * 100,
    }))
    .sort((a, b) => a.diff_percent - b.diff_percent);

  // Dédupliquer par coureur_id : garder uniquement l'enchère la plus proche
  const closeCallsMap = new Map<string, (typeof closeCallsRaw)[number]>();
  closeCallsRaw.forEach((c) => {
    const key = c.coureur_id;
    if (key && (!closeCallsMap.has(key) || c.diff_percent < closeCallsMap.get(key)!.diff_percent)) {
      closeCallsMap.set(key, c);
    }
  });
  const closeCalls = [...closeCallsMap.values()]
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
        <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-background border-primary/30 hover-scale">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              {t('recap.biggestLoser')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {biggestLoser ? (
              <>
                <p className="text-3xl font-bold text-primary truncate">
                  {biggestLoser[0]}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {biggestLoser[1]} {t('recap.bidsLost')}
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
              {t('recap.maxBid')}
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
              {t('recap.round1King')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {round1King ? (
              <>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 truncate">
                  {round1King[0]}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {round1King[1]} {round1King[1] > 1 ? t('recap.victories_plural') : t('recap.victories')}
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
              {t('recap.round1Loser')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {round1Loser ? (
              <>
                <p className="text-2xl font-bold truncate">{round1Loser[0]}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {round1Loser[1]} {round1Loser[1] > 1 ? t('recap.missed_plural') : t('recap.missed')}
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
              {t('recap.fastest')}
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
                    <span className="text-muted-foreground">{t('round')} {round}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-xs">{t('recap.noData')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau "Les plus gros loupés" */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            😤 {t('recap.biggestMisses')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {closeCalls.length > 0 ? (
            <>
              {/* Mobile: card layout */}
              <div className="space-y-3 md:hidden">
                {closeCalls.map((call, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{call.coureur_nom}</div>
                      <div className="text-xs text-muted-foreground truncate">{call.managers?.nom || "Inconnu"}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{t('recap.bid')}: <span className="font-mono text-foreground">{formatAmount(call.my_bid)}</span></span>
                        <span>→</span>
                        <span>{t('recap.winningBid')}: <span className="font-mono font-bold text-foreground">{formatAmount(call.winning_amount)}</span></span>
                      </div>
                    </div>
                    <Badge variant={call.diff_percent < 5 ? "destructive" : "secondary"} className="shrink-0">
                      {call.diff_percent.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
              {/* Desktop: table layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">{t('recap.manager')}</th>
                      <th className="text-left p-2">{t('recap.rider')}</th>
                      <th className="text-right p-2">{t('recap.bid')}</th>
                      <th className="text-right p-2">{t('recap.winningBid')}</th>
                      <th className="text-right p-2">{t('recap.gap')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closeCalls.map((call, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2 truncate max-w-[100px]">{call.managers?.nom || "Inconnu"}</td>
                        <td className="p-2 truncate max-w-[120px]">{call.coureur_nom}</td>
                        <td className="p-2 text-right font-mono">{formatAmount(call.my_bid)}</td>
                        <td className="p-2 text-right font-mono font-bold">{formatAmount(call.winning_amount)}</td>
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
            </>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">
              {t('recap.noLostBids')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Battle Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            {t('stats.title')}
          </CardTitle>
          <CardDescription className="flex items-center gap-1 text-xs">
            <Info className="h-3 w-3" />
            {t('stats.clickForDetails')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {battleStatsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : battleStats ? (
            <>
              {/* Tableau des stats par manager */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">{t('stats.manager')}</th>
                      <th className="text-right p-2">% {t('stats.soloBids')}</th>
                      <th className="text-right p-2">{t('stats.battlesCount')}</th>
                      <th className="text-right p-2">% {t('stats.battleLossRate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {battleStats.managers.map((m) => (
                      <tr 
                        key={m.nom} 
                        className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedManager(m)}
                      >
                        <td className="p-2 truncate max-w-[120px]">{m.nom}</td>
                        <td className="p-2 text-right">
                          <Badge variant="outline">{m.pctSolo}%</Badge>
                        </td>
                        <td className="p-2 text-right font-mono">{m.battlesEntered}</td>
                        <td className="p-2 text-right">
                          <Badge variant={m.pctBattleLoss > 60 ? "destructive" : "secondary"}>
                            {m.pctBattleLoss}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top Rivalités */}
              {battleStats.topRivalries.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    ⚔️ {t('stats.biggestRivalry')}
                  </h4>
                  <div className="space-y-2">
                    {battleStats.topRivalries.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 rounded-md px-3 py-2">
                        <span className="font-medium">{r.managers[0]} vs {r.managers[1]}</span>
                        <Badge variant="outline">{r.count} {t('stats.battles')}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">
              {t('recap.noBattleData')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog for manager detail */}
      <Dialog open={!!selectedManager} onOpenChange={(open) => !open && setSelectedManager(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              {selectedManager?.nom} - {t('stats.detailTitle')}
            </DialogTitle>
          </DialogHeader>
          {selectedManager && (
            <div className="space-y-4">
              {/* Total bids */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-sm text-muted-foreground">{t('stats.totalBids')}</div>
                <div className="text-2xl font-bold">{selectedManager.totalBids}</div>
              </div>

              {/* Solo calculation */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">% {t('stats.soloBids')}</span>
                  <Badge variant="outline" className="text-lg">{selectedManager.pctSolo}%</Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {t('stats.soloExplanation')}
                </div>
                <div className="bg-muted/30 p-2 rounded text-sm font-mono">
                  = ({selectedManager.soloBids} / {selectedManager.totalBids}) × 100
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {selectedManager.soloBids} {t('stats.soloBids').toLowerCase()} {t('stats.of')} {selectedManager.totalBids} {t('stats.totalBids').toLowerCase()}
                </div>
              </div>

              {/* Battle loss calculation */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">% {t('stats.battleLossRate')}</span>
                  <Badge 
                    variant={selectedManager.pctBattleLoss > 60 ? "destructive" : "secondary"} 
                    className="text-lg"
                  >
                    {selectedManager.pctBattleLoss}%
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {t('stats.battleExplanation')}
                </div>
                <div className="bg-muted/30 p-2 rounded text-sm font-mono">
                  = ({selectedManager.battlesLost} / {selectedManager.battlesEntered}) × 100
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {selectedManager.battlesLost} {t('stats.lost')} {t('stats.of')} {selectedManager.battlesEntered} {t('stats.battlesCount').toLowerCase()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

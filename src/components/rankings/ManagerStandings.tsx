import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueClient } from "@/lib/supabase/leagueClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Shirt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { BonusPointsDetailDialog } from "./BonusPointsDetailDialog";
import { memo, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ManagerPrestigeIcons } from "./ManagerPrestigeIcons";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueStandingsBySeason, useLeagueStandingsByPhase } from "@/hooks/useLeagueStandings";
import { useTranslation } from "react-i18next";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

type StandingsProps = {
  phaseId?: string | null;
  onManagerClick?: (managerId: string) => void;
};

const ManagerNameWithJersey = memo(({ managerId, managerName }: { managerId: string; managerName: string }) => {
  const { selectedSeason } = useSeasonContext();
  const { data: sponsorData } = useManagerSponsor(managerId, selectedSeason?.id);
  
  return (
    <div className="flex items-center gap-2">
      {sponsorData?.jersey_image_url ? (
        <OptimizedImage 
          src={sponsorData.jersey_image_url} 
          alt={`Maillot de ${managerName}`}
          inline
          width={32}
          height={32}
          className="h-8 w-8 object-contain rounded"
        />
      ) : (
        <Shirt className="h-8 w-8 text-muted-foreground" />
      )}
      <div className="flex flex-col">
        <span>{managerName}</span>
        {sponsorData?.sponsor && (
          <span className="text-xs text-muted-foreground italic">
            {sponsorData.sponsor}
          </span>
        )}
      </div>
    </div>
  );
});

// Note: enrichWithManagerNames removed - now handled directly by views

export const ManagerStandings = ({ phaseId, onManagerClick }: StandingsProps) => {
  const { t } = useTranslation('rankings');
  const { selectedSeason, activePhase } = useSeasonContext();
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const leagueClient = useLeagueClient();
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [selectedBonusManager, setSelectedBonusManager] = useState<{
    id: string;
    name: string;
  } | null>(null);
  
  const { data: standings, isLoading } = useQuery({
    queryKey: ["manager-standings", phaseId, selectedSeason?.id, leagueId],
    queryFn: async () => {
      if (!leagueId) return [];

      if (phaseId) {
        // Phase-specific standings
        const { data, error } = await supabase
          .from("v_manager_standings_by_phase_v2")
          .select("*")
          .eq("phase_id", phaseId)
          .eq("league_id", leagueId)
          .order("total_points", { ascending: false });
        
        if (error) throw error;
        return data || [];
      } else if (selectedSeason) {
        // Season-specific standings
        const { data, error } = await supabase
          .from("v_manager_standings_by_season_v2")
          .select("*")
          .eq("saison_id", selectedSeason.id)
          .eq("league_id", leagueId)
          .order("total_points", { ascending: false });
        
        if (error) throw error;
        return data || [];
      }
      
      return [];
    },
    enabled: !leagueLoading,
  });


  // Fetch previous global standings for evolution calculation (global view only)
  const { data: previousGlobalStandings } = useQuery({
    queryKey: ["previous-global-standings", selectedSeason?.id, activePhase?.id],
    queryFn: async () => {
      if (phaseId || !activePhase) return null;

      const { data, error } = await supabase.rpc('get_previous_standings', {
        p_saison_id: selectedSeason?.id || null,
        p_reference_phase_id: activePhase.id,
        p_league_id: leagueId
      });

      if (error) {
        console.error('Error fetching previous standings:', error);
        return null;
      }

      // Convert to Map<manager_id, rank>
      const rankMap = new Map<string, number>();
      data?.forEach((row: any) => {
        rankMap.set(row.manager_id, row.rank);
      });
      return rankMap;
    },
    enabled: !phaseId && !!activePhase,
  });

  const maxPoints = standings?.[0]?.total_points || 1;
  const totalPoints = standings?.reduce((sum, s) => sum + s.total_points, 0) || 1;

const getRankIcon = (rank: number, isBottomThree: boolean) => {
  if (rank === 1) return (
    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-full shadow-md">
      <span className="text-2xl">🥇</span>
    </div>
  );
  if (rank === 2) return (
    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-400 rounded-full shadow-md">
      <span className="text-2xl">🥈</span>
    </div>
  );
  if (rank === 3) return (
    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-amber-200 to-amber-500 rounded-full shadow-md">
      <span className="text-2xl">🥉</span>
    </div>
  );
  if (isBottomThree) return <span className="text-red-500 font-bold text-sm">#{rank}</span>;
  return <span className="text-muted-foreground text-sm">#{rank}</span>;
};

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
        <TableHeader>
          <TableRow className="border-b-2 border-[hsl(var(--bordure-gold))]">
            <TableHead className="w-16 font-bold">{t('standings.rank')}</TableHead>
            <TableHead className="font-bold">{t('standings.manager')}</TableHead>
            <TableHead className="text-right font-bold">{t('standings.points')}</TableHead>
            <TableHead className="text-right font-bold">{t('standings.bonus')}</TableHead>
            <TableHead className="text-right font-bold">{t('standings.scorers')}</TableHead>
            <TableHead className="text-right font-bold">{t('standings.victories')}</TableHead>
            <TableHead className="text-right font-bold">{t('standings.gap')}</TableHead>
            {previousGlobalStandings && <TableHead className="w-24 text-center font-bold">{t('standings.evolution')}</TableHead>}
          </TableRow>
        </TableHeader>
          <TableBody>
            {standings?.map((standing, idx) => {
              const rank = idx + 1;
              const isBottomThree = standings && idx >= standings.length - 3;
              const gapToPrevious = idx > 0 ? standings[idx - 1].total_points - standing.total_points : 0;
              const percentage = ((standing.total_points / totalPoints) * 100).toFixed(1);
              const bonusPoints = (standing.manager_bonus || 0) + (standing.rider_bonus || 0);
              
              // Calculate evolution - ONLY for global view
              let evolution: number | null = null;
              let isNew = false;
              
              if (!phaseId && previousGlobalStandings) {
                const previousRank = previousGlobalStandings.get(standing.manager_id);
                if (previousRank) {
                  evolution = previousRank - rank; // Positive = gained places
                } else {
                  isNew = true;
                }
              }

              return (
                <TableRow 
                  key={standing.manager_id}
              className={cn(
                "cursor-pointer transition-colors duration-200 h-12",
                rank === 1 && "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-950/30 border-l-4 border-yellow-500 font-bold",
                rank === 2 && "bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-900/30 border-l-4 border-gray-400 font-semibold",
                rank === 3 && "bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30 border-l-4 border-amber-600 font-semibold",
                rank <= 3 && "shadow-sm",
                isBottomThree && "bg-gradient-to-r from-red-50/30 to-transparent dark:from-red-950/20 border-l-4 border-red-500/50",
                onManagerClick && rank > 3 && !isBottomThree && "hover:bg-muted/30",
                onManagerClick && (rank <= 3 || isBottomThree) && "hover:bg-yellow-50/50 dark:hover:bg-yellow-950/20"
              )}
                  onClick={() => onManagerClick?.(standing.manager_id)}
                >
                  <TableCell className="font-medium py-2">
                    {getRankIcon(rank, isBottomThree)}
                  </TableCell>
                  <TableCell className="font-semibold py-2">
                    <div className="flex items-center gap-2">
                      <ManagerNameWithJersey 
                        managerId={standing.manager_id} 
                        managerName={standing.manager_nom}
                      />
                      <ManagerPrestigeIcons 
                        managerId={standing.manager_id}
                        phaseId={phaseId}
                        saisonId={selectedSeason?.id}
                      />
                      {rank === 10 && <span className="text-xl">🤡</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <div className="space-y-0.5">
                      <div className="flex items-baseline justify-end gap-1">
                <span className={cn(
                  "font-mono text-lg font-bold",
                  rank === 1 && "text-[#D4AF37]",
                  rank === 2 && "text-gray-400",
                  rank === 3 && "text-[#CD7F32]",
                  rank > 3 && "text-foreground"
                )}>
                  {Math.round(standing.total_points)}
                </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {percentage}%
                      </div>
                    </div>
                  </TableCell>
                  <TableCell 
                    className={cn(
                      "text-right py-2 transition-colors",
                      bonusPoints !== 0 && "cursor-pointer hover:bg-muted/50"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (bonusPoints !== 0) {
                        setSelectedBonusManager({
                          id: standing.manager_id,
                          name: standing.manager_nom
                        });
                        setBonusDialogOpen(true);
                      }
                    }}
                  >
                    {bonusPoints !== 0 ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              className={cn(
                                "bg-[#FFF4CC] border text-xs font-semibold px-2 py-0.5 cursor-pointer",
                                bonusPoints > 0 ? "text-green-700 border-green-300" : "text-red-700 border-red-300"
                              )}
                            >
                              {bonusPoints > 0 ? `+${bonusPoints}` : bonusPoints}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{t('standings.clickForDetails')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-sm font-mono font-medium text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-sm font-mono text-muted-foreground">
                      {standing.nb_scoreurs ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-sm font-mono text-muted-foreground">
                      {standing.nb_victoires ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    {rank === 1 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">
                        -{Math.round(gapToPrevious)}
                      </span>
                    )}
                  </TableCell>
                  {previousGlobalStandings && (
                    <TableCell className="text-center py-2">
                      {isNew ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : evolution !== null && evolution !== 0 ? (
                        <div className={cn(
                          "flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1 rounded-md",
                          evolution > 0 ? "text-green-700 bg-green-50 dark:bg-green-950/30" : "text-red-700 bg-red-50 dark:bg-red-950/30"
                        )}>
                          {evolution > 0 ? (
                            <>
                              <TrendingUp className="h-3.5 w-3.5" />
                              <span>+{evolution}</span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="h-3.5 w-3.5" />
                              <span>{evolution}</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!standings || standings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {t('standings.noStandings')}
          </div>
        )}
      </CardContent>

      {selectedBonusManager && (
        <BonusPointsDetailDialog
          open={bonusDialogOpen}
          onOpenChange={setBonusDialogOpen}
          managerId={selectedBonusManager.id}
          managerName={selectedBonusManager.name}
          phaseId={phaseId || null}
          leagueId={leagueId}
        />
      )}
    </Card>
  );
};

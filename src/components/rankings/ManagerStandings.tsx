import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Shirt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { BonusPointsDetailDialog } from "./BonusPointsDetailDialog";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ManagerPrestigeIcons } from "./ManagerPrestigeIcons";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueStandingsStable } from "@/hooks/useLeagueStandingsStable";

type StandingsProps = {
  phaseId?: string | null;
  onManagerClick?: (managerId: string) => void;
};

const ManagerNameWithJersey = ({ managerId, managerName }: { managerId: string; managerName: string }) => {
  const { selectedSeason } = useSeasonContext();
  const { data: sponsorData } = useManagerSponsor(managerId, selectedSeason?.id);
  
  return (
    <div className="flex items-center gap-2">
      {sponsorData?.jersey_image_url ? (
        <img 
          src={sponsorData.jersey_image_url} 
          alt="Maillot" 
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
};

// Note: enrichWithManagerNames removed - now handled directly by views

export const ManagerStandings = ({ phaseId, onManagerClick }: StandingsProps) => {
  const { selectedSeason, activePhase } = useSeasonContext();
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [selectedBonusManager, setSelectedBonusManager] = useState<{
    id: string;
    name: string;
  } | null>(null);
  
  // Use stable backend function instead of direct view queries
  const { data: standings, isLoading, isError, error } = useLeagueStandingsStable(
    leagueId,
    selectedSeason?.id || null,
    phaseId || null
  );


  // Fetch previous global standings for evolution calculation (global view only)
  const { data: previousGlobalStandings } = useQuery({
    queryKey: ["previous-global-standings", selectedSeason?.id, activePhase?.id],
    queryFn: async () => {
      if (phaseId || !activePhase) return null;

      const { data, error } = await supabase.rpc('get_previous_standings', {
        p_saison_id: selectedSeason?.id || null,
        p_reference_phase_id: activePhase.id
      });

      if (error) {
        console.error('Error fetching previous standings:', error);
        return null;
      }

      // Convert to Map<manager_id, rank>
      const rankMap = new Map<string, number>();
      data?.forEach((row: any) => {
        rankMap.set(row.manager_id, row.previous_rank);
      });
      return rankMap;
    },
    enabled: !phaseId && !!activePhase,
  });

  const maxPoints = standings?.[0]?.total_points || 1;
  const totalPoints = standings?.reduce((sum, s) => sum + s.total_points, 0) || 1;

  const getRankIcon = (rank: number, isBottomThree: boolean) => {
    if (rank === 1) return <span className="text-xl">🥇</span>;
    if (rank === 2) return <span className="text-xl">🥈</span>;
    if (rank === 3) return <span className="text-xl">🥉</span>;
    if (isBottomThree) return <span className="text-red-500 font-bold text-sm">#{rank}</span>;
    return <span className="text-muted-foreground text-sm">#{rank}</span>;
  };

  if (isLoading || leagueLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            Erreur de chargement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Impossible de charger le classement. {error?.message || 'Veuillez réessayer.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Classement des Managers
        </CardTitle>
        <CardDescription>
          {phaseId ? "Classement pour la phase sélectionnée" : "Classement général"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rang</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">dont bonus</TableHead>
              <TableHead className="text-right">Scoreurs</TableHead>
              <TableHead className="text-right">Victoires</TableHead>
              <TableHead className="text-right">Écart</TableHead>
              {previousGlobalStandings && <TableHead className="w-24 text-center">Évolution</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings?.map((standing, idx) => {
              const rank = idx + 1;
              const isBottomThree = standings && idx >= standings.length - 3;
              const gapToPrevious = idx > 0 ? standings[idx - 1].total_points - standing.total_points : 0;
              const percentage = ((standing.total_points / totalPoints) * 100).toFixed(1);
              
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
                    "cursor-pointer transition-all h-12",
                    rank === 1 && "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-950/30 border-l-4 border-yellow-500 font-bold",
                    rank === 2 && "bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-900/30 border-l-4 border-gray-400 font-semibold",
                    rank === 3 && "bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30 border-l-4 border-amber-600 font-semibold",
                    rank <= 3 && "shadow-sm",
                    isBottomThree && rank > 3 && "bg-gradient-to-r from-red-50/30 to-transparent dark:from-red-950/20 border-l-4 border-red-500/50",
                    onManagerClick && "hover:bg-muted/50"
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
                          "font-mono",
                          rank === 1 && "text-lg font-bold text-yellow-600",
                          rank === 2 && "text-base font-bold text-gray-500",
                          rank === 3 && "text-base font-bold text-amber-600",
                          rank > 3 && "text-sm font-semibold text-foreground"
                        )}>
                          {standing.total_points}
                        </span>
                        <span className="text-xs text-muted-foreground">pts</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {percentage}%
                      </div>
                    </div>
                  </TableCell>
                  <TableCell 
                    className={cn(
                      "text-right py-2 transition-colors",
                      standing.bonus_points !== 0 && "cursor-pointer hover:bg-muted/50"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (standing.bonus_points !== 0) {
                        setSelectedBonusManager({
                          id: standing.manager_id,
                          name: standing.manager_nom
                        });
                        setBonusDialogOpen(true);
                      }
                    }}
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "text-sm font-mono font-medium",
                            standing.bonus_points > 0 && "text-green-600 underline decoration-dotted",
                            standing.bonus_points < 0 && "text-red-600 underline decoration-dotted",
                            standing.bonus_points === 0 && "text-muted-foreground"
                          )}>
                            {standing.bonus_points > 0 ? `+${standing.bonus_points}` : standing.bonus_points === 0 ? '0' : standing.bonus_points}
                          </span>
                        </TooltipTrigger>
                        {standing.bonus_points !== 0 && (
                          <TooltipContent>
                            <p className="text-xs">Cliquer pour voir le détail</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-sm font-mono text-muted-foreground">
                      {standing.scoreurs_count ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-sm font-mono text-muted-foreground">
                      {standing.victories_count ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    {rank === 1 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">
                        -{gapToPrevious}
                      </span>
                    )}
                  </TableCell>
                  {previousGlobalStandings && (
                    <TableCell className="text-center py-2">
                      {isNew ? (
                        <Badge variant="outline" className="text-xs">NEW</Badge>
                      ) : evolution !== null && evolution !== 0 ? (
                        <div className={cn(
                          "flex items-center justify-center gap-1 text-xs font-semibold",
                          evolution > 0 ? "text-green-600" : "text-red-600"
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
        {(!standings || standings.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun classement disponible
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
        />
      )}
    </Card>
  );
};

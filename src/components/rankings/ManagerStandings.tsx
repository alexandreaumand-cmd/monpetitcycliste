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

export const ManagerStandings = ({ phaseId, onManagerClick }: StandingsProps) => {
  const { selectedSeason } = useSeasonContext();
  
  const { data: standings, isLoading } = useQuery({
    queryKey: ["manager-standings", phaseId, selectedSeason?.id],
    queryFn: async () => {
      if (phaseId) {
        // Cumulative standings up to and including this phase
        const { data: currentPhase } = await supabase
          .from("phases")
          .select("index_dans_saison, saison_id")
          .eq("id", phaseId)
          .single();

        if (!currentPhase) throw new Error("Phase not found");

        // Get all phases up to and including the current phase
        const { data: phasesUpToNow } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", currentPhase.saison_id)
          .lte("index_dans_saison", currentPhase.index_dans_saison);

        if (!phasesUpToNow || phasesUpToNow.length === 0) return [];

        const phaseIds = phasesUpToNow.map(p => p.id);

        // Get cumulative points
        const { data: pointsData } = await supabase
          .from("points_ledger")
          .select("manager_id, points")
          .in("phase_id", phaseIds);

        // Get bonus points
        const { data: bonusData } = await supabase
          .from("bonus_points")
          .select("target_manager_id, points")
          .in("phase_id", phaseIds);

        // Get manager info
        const { data: managers } = await supabase
          .from("managers")
          .select("id, nom");

        if (!managers) return [];

        // Aggregate by manager
        const managerStats = new Map<string, { points: number; bonus: number; name: string }>();

        managers.forEach(m => {
          managerStats.set(m.id, { points: 0, bonus: 0, name: m.nom });
        });

        pointsData?.forEach(row => {
          if (!row.manager_id) return;
          const stats = managerStats.get(row.manager_id);
          if (stats) {
            stats.points += row.points || 0;
          }
        });

        bonusData?.forEach(row => {
          if (!row.target_manager_id) return;
          const stats = managerStats.get(row.target_manager_id);
          if (stats) {
            stats.bonus += row.points || 0;
          }
        });

        // Convert to array and sort
        const result = Array.from(managerStats.entries())
          .map(([managerId, stats]) => ({
            manager_id: managerId,
            manager_nom: stats.name,
            total_points: stats.points + stats.bonus,
            bonus_points: stats.bonus,
          }))
          .sort((a, b) => b.total_points - a.total_points);

        return result;
      } else if (selectedSeason) {
        // Season-specific standings (all phases of the season)
        const { data, error } = await supabase
          .from("v_manager_standings_by_season")
          .select("*")
          .eq("saison_id", selectedSeason.id)
          .order("total_points", { ascending: false});
        
        if (error) throw error;
        return data;
      } else {
        // Global standings (all time)
        const { data, error } = await supabase
          .from("v_manager_standings_total")
          .select("*")
          .order("total_points", { ascending: false});
        
        if (error) throw error;
        return data;
      }
    },
  });

  // Fetch cumulative standings up to previous phase for evolution calculation
  const { data: previousStandings } = useQuery({
    queryKey: ["previous-cumulative-standings", phaseId],
    queryFn: async () => {
      if (!phaseId) return null;

      // Get current phase info
      const { data: currentPhase } = await supabase
        .from("phases")
        .select("index_dans_saison, saison_id")
        .eq("id", phaseId)
        .single();

      if (!currentPhase || currentPhase.index_dans_saison <= 1) return null;

      // Get all phases up to (but not including) the current phase
      const { data: previousPhases } = await supabase
        .from("phases")
        .select("id")
        .eq("saison_id", currentPhase.saison_id)
        .lt("index_dans_saison", currentPhase.index_dans_saison);

      if (!previousPhases || previousPhases.length === 0) return null;

      const phaseIds = previousPhases.map(p => p.id);

      // Get cumulative points for all previous phases
      const { data: pointsData } = await supabase
        .from("points_ledger")
        .select("manager_id, points")
        .in("phase_id", phaseIds);

      // Get bonus points for all previous phases
      const { data: bonusData } = await supabase
        .from("bonus_points")
        .select("target_manager_id, points")
        .in("phase_id", phaseIds);

      if (!pointsData) return null;

      // Aggregate points by manager
      const managerPoints = new Map<string, number>();
      
      pointsData.forEach(row => {
        if (!row.manager_id) return;
        const current = managerPoints.get(row.manager_id) || 0;
        managerPoints.set(row.manager_id, current + (row.points || 0));
      });

      // Add bonus points
      bonusData?.forEach(row => {
        if (!row.target_manager_id) return;
        const current = managerPoints.get(row.target_manager_id) || 0;
        managerPoints.set(row.target_manager_id, current + (row.points || 0));
      });

      // Sort by total points and create rank map
      const sorted = Array.from(managerPoints.entries())
        .sort((a, b) => b[1] - a[1]);

      const rankMap = new Map<string, number>();
      sorted.forEach(([managerId], idx) => {
        rankMap.set(managerId, idx + 1);
      });

      return rankMap;
    },
    enabled: !!phaseId,
  });

  // Fetch previous global standings for evolution calculation (global view only)
  const { data: previousGlobalStandings } = useQuery({
    queryKey: ["previous-global-standings"],
    queryFn: async () => {
      if (phaseId) return null; // Only for global standings
      
      // 1. Find the active phase
      const { data: activePhase } = await supabase
        .from("phases")
        .select("id, index_dans_saison, saison_id")
        .eq("statut", "active")
        .order("index_dans_saison", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!activePhase || activePhase.index_dans_saison === 1) return null;
      
      // 2. Find all completed phases before the active phase
      const { data: completedPhases } = await supabase
        .from("phases")
        .select("id")
        .eq("saison_id", activePhase.saison_id)
        .eq("statut", "completed")
        .lt("index_dans_saison", activePhase.index_dans_saison);
      
      if (!completedPhases || completedPhases.length === 0) return null;
      
      const phaseIds = completedPhases.map(p => p.id);
      
      // 3. Calculate global standings up to the end of the previous phase
      const { data: pointsData } = await supabase
        .from("points_ledger")
        .select("manager_id, points")
        .in("phase_id", phaseIds);
      
      if (!pointsData) return null;
      
      // 4. Aggregate by manager
      const managerPoints = new Map<string, number>();
      pointsData.forEach(row => {
        const current = managerPoints.get(row.manager_id) || 0;
        managerPoints.set(row.manager_id, current + (row.points || 0));
      });
      
      // 5. Sort and create a rank map
      const sorted = Array.from(managerPoints.entries())
        .sort((a, b) => b[1] - a[1]);
      
      const rankMap = new Map<string, number>();
      sorted.forEach(([managerId], idx) => {
        rankMap.set(managerId, idx + 1);
      });
      
      return rankMap;
    },
    enabled: !phaseId, // Only if global standings
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

  if (isLoading) {
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
              {phaseId && <TableHead className="text-right">Scoreurs</TableHead>}
              <TableHead className="text-right">Écart</TableHead>
              {(phaseId || previousGlobalStandings) && <TableHead className="w-24 text-center">Évolution</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings?.map((standing, idx) => {
              const rank = idx + 1;
              const isBottomThree = standings && idx >= standings.length - 3;
              const gapToPrevious = idx > 0 ? standings[idx - 1].total_points - standing.total_points : 0;
              const percentage = ((standing.total_points / totalPoints) * 100).toFixed(1);
              
              // Calculate evolution
              let evolution: number | null = null;
              let isNew = false;
              
              // For phase-specific view
              if (phaseId && previousStandings) {
                const previousRank = previousStandings.get(standing.manager_id);
                if (previousRank) {
                  evolution = previousRank - rank; // Positive = gained places
                } else {
                  isNew = true;
                }
              }
              
              // For global view
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
                  <TableCell className="text-right py-2">
                    <span className={cn(
                      "text-sm font-mono font-medium",
                      standing.bonus_points > 0 && "text-green-600",
                      standing.bonus_points < 0 && "text-red-600",
                      standing.bonus_points === 0 && "text-muted-foreground"
                    )}>
                      {standing.bonus_points > 0 ? `+${standing.bonus_points}` : standing.bonus_points === 0 ? '0' : standing.bonus_points}
                    </span>
                  </TableCell>
                  {phaseId && (
                    <TableCell className="text-right py-2">
                      <span className="text-sm font-mono text-muted-foreground">
                        {(standing as any).scoreurs_count ?? 0}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-right py-2">
                    {rank === 1 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">
                        -{gapToPrevious}
                      </span>
                    )}
                  </TableCell>
                  {(phaseId || previousGlobalStandings) && (
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
        {!standings || standings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun classement disponible
          </div>
        )}
      </CardContent>
    </Card>
  );
};

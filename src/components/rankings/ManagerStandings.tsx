import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, TrendingDown, Medal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StandingsProps = {
  phaseId?: string | null;
  onManagerClick?: (managerId: string) => void;
};

export const ManagerStandings = ({ phaseId, onManagerClick }: StandingsProps) => {
  const { data: standings, isLoading } = useQuery({
    queryKey: ["manager-standings", phaseId],
    queryFn: async () => {
      if (phaseId) {
        const { data, error } = await supabase
          .from("v_manager_standings_by_phase")
          .select("*")
          .eq("phase_id", phaseId)
          .order("total_points", { ascending: false });
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("v_manager_standings_total")
          .select("*")
          .order("total_points", { ascending: false });
        
        if (error) throw error;
        return data;
      }
    },
  });

  // Fetch previous phase standings for evolution calculation
  const { data: previousStandings } = useQuery({
    queryKey: ["previous-manager-standings", phaseId],
    queryFn: async () => {
      if (!phaseId) return null;

      // Get current phase info
      const { data: currentPhase } = await supabase
        .from("phases")
        .select("index_dans_saison, saison_id")
        .eq("id", phaseId)
        .single();

      if (!currentPhase || currentPhase.index_dans_saison <= 1) return null;

      // Get previous phase
      const { data: prevPhase } = await supabase
        .from("phases")
        .select("id")
        .eq("saison_id", currentPhase.saison_id)
        .eq("index_dans_saison", currentPhase.index_dans_saison - 1)
        .single();

      if (!prevPhase) return null;

      // Get previous phase standings
      const { data, error } = await supabase
        .from("v_manager_standings_by_phase")
        .select("*")
        .eq("phase_id", prevPhase.id)
        .order("total_points", { ascending: false });

      if (error) return null;

      // Create a map of manager_id -> rank
      const rankMap = new Map();
      data?.forEach((standing, idx) => {
        rankMap.set(standing.manager_id, idx + 1);
      });

      return rankMap;
    },
    enabled: !!phaseId,
  });

  const maxPoints = standings?.[0]?.total_points || 1;

  const getRankIcon = (rank: number, isBottomThree: boolean) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    if (isBottomThree) return <span className="text-red-500 font-bold">#{rank}</span>;
    return <span className="text-muted-foreground">#{rank}</span>;
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
              <TableHead className="text-right">Écart</TableHead>
              {phaseId && <TableHead className="w-24 text-center">Évolution</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings?.map((standing, idx) => {
              const rank = idx + 1;
              const isBottomThree = standings && idx >= standings.length - 3;
              const gapToPrevious = idx > 0 ? standings[idx - 1].total_points - standing.total_points : 0;
              
              // Calculate evolution
              let evolution: number | null = null;
              let isNew = false;
              if (phaseId && previousStandings) {
                const previousRank = previousStandings.get(standing.manager_id);
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
                    "cursor-pointer transition-all",
                    rank === 1 && "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-950/30 border-l-4 border-yellow-500 font-bold",
                    rank === 2 && "bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-900/30 border-l-4 border-gray-400 font-semibold",
                    rank === 3 && "bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30 border-l-4 border-amber-600 font-semibold",
                    rank <= 3 && "shadow-sm",
                    isBottomThree && rank > 3 && "bg-gradient-to-r from-red-50/30 to-transparent dark:from-red-950/20 border-l-4 border-red-500/50",
                    onManagerClick && "hover:bg-muted/50"
                  )}
                  onClick={() => onManagerClick?.(standing.manager_id)}
                >
                  <TableCell className="font-medium">
                    {getRankIcon(rank, isBottomThree)}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {standing.manager_nom}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className={cn(
                        "font-mono",
                        rank === 1 && "text-xl font-bold text-yellow-600",
                        rank === 2 && "text-lg font-bold text-gray-500",
                        rank === 3 && "text-lg font-bold text-amber-600",
                        rank > 3 && "text-base font-semibold text-foreground"
                      )}>
                        {standing.total_points}
                      </span>
                      <span className="text-xs text-muted-foreground">pts</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {rank === 1 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">
                        -{gapToPrevious}
                      </span>
                    )}
                  </TableCell>
                  {phaseId && (
                    <TableCell className="text-center">
                      {isNew ? (
                        <Badge variant="outline" className="text-xs">NEW</Badge>
                      ) : evolution !== null && evolution !== 0 ? (
                        <div className={cn(
                          "flex items-center justify-center gap-1 text-sm font-semibold",
                          evolution > 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {evolution > 0 ? (
                            <>
                              <TrendingUp className="h-4 w-4" />
                              <span>+{evolution}</span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="h-4 w-4" />
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

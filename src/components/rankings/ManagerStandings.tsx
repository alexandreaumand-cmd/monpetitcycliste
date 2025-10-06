import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Medal } from "lucide-react";
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
              <TableHead className="text-right">Écart au leader</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings?.map((standing, idx) => {
              const rank = idx + 1;
              const isBottomThree = standings && idx >= standings.length - 3;
              const gapToLeader = maxPoints - standing.total_points;

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
                    <Badge variant={rank <= 3 ? "default" : "secondary"}>
                      {standing.total_points} pts
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {rank === 1 ? (
                      <span className="text-sm text-muted-foreground font-medium">Leader</span>
                    ) : (
                      <span className="text-sm text-destructive font-mono">
                        −{gapToLeader} pts
                      </span>
                    )}
                  </TableCell>
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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Medal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
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
              <TableHead className="text-right">Courses</TableHead>
              <TableHead className="w-48">Progression</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings?.map((standing, idx) => {
              const rank = idx + 1;
              const delta = idx > 0 ? standing.total_points - standings[idx - 1].total_points : 0;
              const progressPercent = (standing.total_points / maxPoints) * 100;

              return (
                <TableRow 
                  key={standing.manager_id}
                  className={onManagerClick ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={() => onManagerClick?.(standing.manager_id)}
                >
                  <TableCell className="font-medium">
                    {getRankIcon(rank)}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {standing.manager_nom}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={rank <= 3 ? "default" : "secondary"}>
                      {standing.total_points} pts
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {standing.courses_count}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={progressPercent} className="h-2" />
                      {delta !== 0 && idx > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {delta} pts d'écart
                        </p>
                      )}
                    </div>
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

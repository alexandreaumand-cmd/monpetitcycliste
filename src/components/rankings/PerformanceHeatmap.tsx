import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";

interface PerformanceHeatmapProps {
  saisonId: string;
}

const getColorForPercentile = (percentile: number) => {
  if (percentile >= 90) return 'bg-secondary text-secondary-foreground hover:bg-secondary/90';
  if (percentile >= 75) return 'bg-secondary/70 text-secondary-foreground hover:bg-secondary/80';
  if (percentile >= 50) return 'bg-primary/30 text-foreground hover:bg-primary/40';
  if (percentile >= 25) return 'bg-primary/60 text-primary-foreground hover:bg-primary/70';
  return 'bg-bordure-gold text-primary-foreground hover:bg-primary';
};

const getInterpretationForPercentile = (percentile: number) => {
  if (percentile >= 90) return 'Top 10%';
  if (percentile >= 75) return 'Top 25%';
  if (percentile >= 50) return 'Milieu de tableau';
  if (percentile >= 25) return 'Danger zone';
  return 'Bottom 25%';
};

export const PerformanceHeatmap = ({ saisonId }: PerformanceHeatmapProps) => {
  const [sortBy, setSortBy] = useState<'points' | 'name'>('points');
  const [topN, setTopN] = useState<string>('all');
  const { leagueId, isLoading: leagueLoading } = useLeague();

  const { data, isLoading } = useQuery({
    queryKey: ['performance-matrix', saisonId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-performance-matrix', {
        body: { saison_id: saisonId, league_id: leagueId }
      });
      if (error) throw error;
      return data;
    },
    enabled: !leagueLoading && !!leagueId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.matrix || data.matrix.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Heatmap des performances</CardTitle>
          <CardDescription>Aucune donnée disponible</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  let sortedMatrix = [...data.matrix];
  
  if (sortBy === 'name') {
    sortedMatrix.sort((a: any, b: any) => a.manager_nom.localeCompare(b.manager_nom));
  }

  if (topN !== 'all') {
    sortedMatrix = sortedMatrix.slice(0, parseInt(topN));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Heatmap des performances
            </CardTitle>
            <CardDescription>
              Visualisation des performances par manager et par phase (code couleur basé sur le percentile)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="points">Trier par points</SelectItem>
                <SelectItem value="name">Trier par nom</SelectItem>
              </SelectContent>
            </Select>
            <Select value={topN} onValueChange={setTopN}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Légende */}
        <div className="flex gap-2 mb-4 text-xs flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-secondary rounded" />
            <span>Top 10%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-secondary/70 rounded" />
            <span>Top 25%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-primary/30 rounded" />
            <span>Milieu</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-primary/60 rounded" />
            <span>Danger</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-bordure-gold rounded" />
            <span>Bottom 25%</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <TooltipProvider>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 bg-card p-2 text-left font-semibold min-w-[150px]">
                    Manager
                  </th>
                  {data.phases.map((phase: any) => (
                    <th key={phase.id} className="p-2 text-center font-semibold min-w-[80px]">
                      {phase.label}
                    </th>
                  ))}
                  <th className="p-2 text-right font-semibold min-w-[100px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMatrix.map((manager: any, idx: number) => (
                  <tr key={manager.manager_id} className="border-b hover:bg-muted/50">
                    <td className="sticky left-0 bg-card p-2 font-medium">
                      {idx < 3 && sortBy === 'points' && (
                        <Trophy className="inline-block h-4 w-4 mr-1 text-bordure-gold" />
                      )}
                      {manager.manager_nom}
                    </td>
                    {manager.phases.map((phase: any) => (
                      <td key={phase.phase_id} className="p-1 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {(() => {
                              const phaseInfo = data.phases.find((p: any) => p.id === phase.phase_id);
                              const isFuture = phaseInfo && phaseInfo.statut !== 'active' && phaseInfo.statut !== 'completed';
                              if (isFuture || phase.points === 0) {
                                return <div className="rounded px-2 py-1 text-xs text-muted-foreground">—</div>;
                              }
                              return (
                                <div
                                  className={cn(
                                    "rounded px-2 py-1 text-xs font-medium cursor-pointer transition-colors",
                                    getColorForPercentile(phase.percentile)
                                  )}
                                >
                                  {phase.rank}
                                  <sup>e</sup>
                                </div>
                              );
                            })()}
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <p className="font-semibold">{phase.rank}/{phase.total_managers}</p>
                              <p>{phase.points} points</p>
                              <p className="text-muted-foreground">
                                {getInterpretationForPercentile(phase.percentile)}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold">
                      {manager.total_points.toLocaleString()} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};

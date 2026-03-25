import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import { useState } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

interface ConsistencyScoresProps {
  saisonId: string;
}

const getLabel = (score: number) => {
  if (score >= 90) return { text: '🌟 Très régulier', short: '🌟', cls: 'bg-green-500 text-white' };
  if (score >= 80) return { text: '✅ Régulier', short: '✅', cls: 'bg-lime-500 text-foreground' };
  if (score >= 70) return { text: '➖ Moyen', short: '➖', cls: 'bg-bordure-gold text-foreground' };
  if (score >= 60) return { text: '⚠️ Irrégulier', short: '⚠️', cls: 'bg-orange-500 text-foreground' };
  return { text: '📉 Très irrégulier', short: '📉', cls: 'bg-red-500 text-white' };
};

const getGaugeColor = (score: number) => {
  if (score >= 90) return 'bg-green-500';
  if (score >= 80) return 'bg-lime-500';
  if (score >= 70) return 'bg-bordure-gold';
  if (score >= 60) return 'bg-orange-500';
  return 'bg-red-500';
};

export const ConsistencyScores = ({ saisonId }: ConsistencyScoresProps) => {
  const [topN, setTopN] = useState<string>('all');
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ['consistency-scores', saisonId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-consistency-scores', {
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
        <CardHeader><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></CardHeader>
        <CardContent><Skeleton className="h-96 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data || !data.scores || data.scores.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Régularité</CardTitle>
          <CardDescription>Aucune donnée disponible</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  let displayedScores = [...data.scores];
  if (topN !== 'all') {
    displayedScores = displayedScores.slice(0, parseInt(topN));
  }

  return (
    <Card>
      <CardHeader className={isMobile ? "pb-3" : undefined}>
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base md:text-xl">
              <Activity className="h-5 w-5 flex-shrink-0" />
              Régularité
            </CardTitle>
            {!isMobile && (
              <CardDescription>
                Qui performe de manière constante ? Score basé sur la répartition des points entre les phases
              </CardDescription>
            )}
          </div>
          <Select value={topN} onValueChange={setTopN}>
            <SelectTrigger className="w-[80px] md:w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className={isMobile ? "pt-0" : undefined}>
        <TooltipProvider>
          <div className="space-y-2 md:space-y-3">
            {displayedScores.map((score: any, idx: number) => {
              const label = getLabel(score.consistency_score);
              return (
                <div
                  key={score.manager_id}
                  className={cn(
                    "rounded-lg border bg-card hover:bg-muted/50 transition-colors",
                    isMobile ? "p-2.5" : "flex items-center gap-4 p-3"
                  )}
                >
                  {isMobile ? (
                    // Mobile: stacked layout
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-muted-foreground text-sm">#{idx + 1}</span>
                          <span className="font-semibold text-sm truncate">{score.manager_nom}</span>
                        </div>
                        <Badge className={cn(label.cls, "text-[10px] px-1.5 py-0")}>{label.short}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                          <div
                            className={cn("h-full transition-all rounded-full", getGaugeColor(score.consistency_score))}
                            style={{ width: `${score.consistency_score}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-6 text-right">{score.consistency_score}</span>
                        {/* Mini sparkline */}
                        <div className="flex items-end gap-px h-5 w-16">
                          {score.points_by_phase?.map((phase: any, i: number) => {
                            const maxPts = Math.max(...score.points_by_phase.map((p: any) => p.points), 1);
                            const h = Math.max((phase.points / maxPts) * 100, 8);
                            return (
                              <div key={i} className={cn("flex-1 rounded-t", getGaugeColor(score.consistency_score))} style={{ height: `${h}%` }} />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Desktop: horizontal layout
                    <>
                      <div className="flex-shrink-0 w-8 text-center font-bold text-muted-foreground">#{idx + 1}</div>
                      <div className="w-[120px] min-w-[100px]">
                        <p className="font-semibold truncate">{score.manager_nom}</p>
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                            <div className={cn("h-full transition-all rounded-full", getGaugeColor(score.consistency_score))} style={{ width: `${score.consistency_score}%` }} />
                          </div>
                          <span className="text-sm font-bold w-8 text-right">{score.consistency_score}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Badge className={cn(label.cls)}>{label.text}</Badge>
                      </div>
                      <div className="flex-shrink-0 w-28 h-8 flex items-end gap-0.5">
                        {score.points_by_phase?.map((phase: any, i: number) => {
                          const maxPoints = Math.max(...score.points_by_phase.map((p: any) => p.points), 1);
                          const height = Math.max((phase.points / maxPoints) * 100, 4);
                          return (
                            <Tooltip key={i}>
                              <TooltipTrigger asChild>
                                <div className={cn("flex-1 rounded-t cursor-pointer", getGaugeColor(score.consistency_score))} style={{ height: `${height}%` }} />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs font-medium">Phase {phase.phase_index}</p>
                                <p className="text-xs">{Math.round(phase.points)} pts ({phase.percentage}%)</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Summary */}
        <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
          <div className="grid grid-cols-3 gap-2 md:gap-4 text-center text-xs md:text-sm">
            <div>
              <p className="text-muted-foreground">🏆 Le + régulier</p>
              <p className="font-semibold truncate">{data.scores[0]?.manager_nom}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{data.scores[0]?.consistency_score}</p>
            </div>
            <div>
              <p className="text-muted-foreground">🎢 Le + irrégulier</p>
              <p className="font-semibold truncate">{data.scores[data.scores.length - 1]?.manager_nom}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{data.scores[data.scores.length - 1]?.consistency_score}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Moyenne</p>
              <p className="font-semibold">
                {Math.round(data.scores.reduce((sum: number, s: any) => sum + s.consistency_score, 0) / data.scores.length)}
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{data.scores.length} managers</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

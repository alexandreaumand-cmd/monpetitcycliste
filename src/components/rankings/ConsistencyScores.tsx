import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, Activity } from "lucide-react";
import { useState } from "react";

interface ConsistencyScoresProps {
  saisonId: string;
}

const getInterpretationColor = (interpretation: string) => {
  switch (interpretation) {
    case 'Excellent': return 'bg-green-500 text-white';
    case 'Bon': return 'bg-lime-500 text-foreground';
    case 'Moyen': return 'bg-yellow-500 text-foreground';
    case 'Variable': return 'bg-orange-500 text-foreground';
    case 'Très variable': return 'bg-red-500 text-white';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getInterpretationIcon = (interpretation: string) => {
  switch (interpretation) {
    case 'Excellent': return '🌟';
    case 'Bon': return '✅';
    case 'Moyen': return '➖';
    case 'Variable': return '⚠️';
    case 'Très variable': return '📉';
    default: return '•';
  }
};

const getGaugeColor = (score: number) => {
  if (score >= 90) return 'bg-green-500';
  if (score >= 80) return 'bg-lime-500';
  if (score >= 70) return 'bg-yellow-500';
  if (score >= 60) return 'bg-orange-500';
  return 'bg-red-500';
};

export const ConsistencyScores = ({ saisonId }: ConsistencyScoresProps) => {
  const [topN, setTopN] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['consistency-scores', saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-consistency-scores', {
        body: { saison_id: saisonId }
      });
      if (error) throw error;
      return data;
    },
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

  if (!data || !data.scores || data.scores.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Consistency Score</CardTitle>
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
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Consistency Score
            </CardTitle>
            <CardDescription>
              Métrique de régularité des managers (plus le score est élevé, plus le manager est constant)
            </CardDescription>
          </div>
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
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayedScores.map((score: any, idx: number) => (
            <div 
              key={score.manager_id}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              {/* Rang */}
              <div className="flex-shrink-0 w-8 text-center font-bold text-muted-foreground">
                #{idx + 1}
              </div>

              {/* Manager */}
              <div className="flex-1 min-w-[150px]">
                <p className="font-semibold">{score.manager_nom}</p>
              </div>

              {/* Consistency Score Gauge */}
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all",
                        getGaugeColor(score.consistency_score)
                      )}
                      style={{ width: `${score.consistency_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold w-12 text-right">
                    {score.consistency_score}
                  </span>
                </div>
              </div>

              {/* Interprétation */}
              <div className="flex-shrink-0">
                <Badge className={cn(getInterpretationColor(score.interpretation))}>
                  {getInterpretationIcon(score.interpretation)} {score.interpretation}
                </Badge>
              </div>

              {/* Stats */}
              <div className="flex-1 min-w-[250px] grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Moyenne</p>
                  <p className="font-semibold">{score.stats.mean} pts</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Écart-type</p>
                  <p className="font-semibold">σ = {score.stats.std_dev}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Range</p>
                  <p className="font-semibold">
                    {score.stats.min} - {score.stats.max}
                  </p>
                </div>
              </div>

              {/* Sparkline */}
              <div className="flex-shrink-0 w-32 h-8 flex items-end gap-0.5">
                {score.points_by_phase.map((phase: any, i: number) => {
                  const maxPoints = Math.max(...score.points_by_phase.map((p: any) => p.points));
                  const height = (phase.points / maxPoints) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-primary rounded-t"
                      style={{ height: `${height}%` }}
                      title={`Phase ${phase.phase_index}: ${phase.points} pts`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Manager le plus régulier</p>
              <p className="font-semibold">
                {data.scores[0]?.manager_nom} ({data.scores[0]?.consistency_score})
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Manager le plus volatile</p>
              <p className="font-semibold">
                {data.scores[data.scores.length - 1]?.manager_nom} ({data.scores[data.scores.length - 1]?.consistency_score})
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Score moyen</p>
              <p className="font-semibold">
                {Math.round(data.scores.reduce((sum: number, s: any) => sum + s.consistency_score, 0) / data.scores.length)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Managers analysés</p>
              <p className="font-semibold">{data.scores.length}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

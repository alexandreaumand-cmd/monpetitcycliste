import { useLuckRanking } from "@/hooks/useLuckRanking";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clover, TrendingUp, Zap, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LuckRankingProps {
  saisonId: string;
}

export const LuckRanking = ({ saisonId }: LuckRankingProps) => {
  const { data, isLoading } = useLuckRanking(saisonId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const rankings = data?.rankings || [];
  const avgGap = rankings.length > 0
    ? Math.round(rankings.reduce((sum, r) => sum + r.performance_gap, 0) / rankings.length * 10) / 10
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clover className="h-6 w-6 text-green-500" />
          Classement "La Chatte"
        </CardTitle>
        <CardDescription>
          Qui a la chance avec eux ? Score basé sur l'écart entre performance attendue et réelle, variance et gros coups
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rankings.map((manager, idx) => (
          <div
            key={manager.manager_id}
            className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors relative"
          >
            {/* Special badges */}
            {idx === 0 && (
              <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-500">
                🍀 Le plus chanceux
              </Badge>
            )}
            {idx === rankings.length - 1 && rankings.length > 1 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2">
                💩 Le plus malchanceux
              </Badge>
            )}

            {/* Rank */}
            <div className="w-12 text-center">
              <div className="font-bold text-2xl text-muted-foreground">
                #{idx + 1}
              </div>
            </div>

            {/* Manager name */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-lg truncate">{manager.manager_nom}</div>
            </div>

            {/* Score gauge */}
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Score chance</span>
                <span className="font-bold text-foreground">{manager.luck_score}</span>
              </div>
              <div className="bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all duration-500"
                  style={{ width: `${manager.luck_score}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-xs">Écart perf.</span>
                </div>
                <div className={`font-semibold text-sm ${manager.performance_gap > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {manager.performance_gap > 0 ? '+' : ''}{manager.performance_gap}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  <span className="text-xs">Variance</span>
                </div>
                <div className="font-semibold text-sm">{manager.variance}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Target className="h-3 w-3" />
                  <span className="text-xs">Gros coups</span>
                </div>
                <div className="font-semibold text-sm">{manager.big_wins_ratio}%</div>
              </div>
            </div>
          </div>
        ))}

        {/* Summary */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">🍀 Le plus chanceux</div>
              <div className="font-semibold text-lg">{rankings[0]?.manager_nom || '-'}</div>
              <div className="text-xs text-muted-foreground">
                Score: {rankings[0]?.luck_score || 0}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">💩 Le plus malchanceux</div>
              <div className="font-semibold text-lg">{rankings[rankings.length - 1]?.manager_nom || '-'}</div>
              <div className="text-xs text-muted-foreground">
                Score: {rankings[rankings.length - 1]?.luck_score || 0}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Écart moyen</div>
              <div className={`font-semibold text-lg ${avgGap > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {avgGap > 0 ? '+' : ''}{avgGap}%
              </div>
              <div className="text-xs text-muted-foreground">
                {rankings.length} managers
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

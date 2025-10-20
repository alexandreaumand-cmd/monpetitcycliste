import { useKnowledgeRanking } from "@/hooks/useKnowledgeRanking";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, Award, Target } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";

interface BikeKnowledgeRankingProps {
  saisonId: string;
}

export const BikeKnowledgeRanking = ({ saisonId }: BikeKnowledgeRankingProps) => {
  const { leagueId } = useLeague();
  const { data, isLoading } = useKnowledgeRanking(saisonId, leagueId);

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
  const avgScore = rankings.length > 0
    ? Math.round(rankings.reduce((sum, r) => sum + r.knowledge_score, 0) / rankings.length)
    : 0;
  const totalPepites = rankings.reduce((sum, r) => sum + r.pepites_count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-6 w-6" />
          Classement Connaissance Vélo
        </CardTitle>
        <CardDescription>
          Qui sait mieux sélectionner ses coureurs ? Score basé sur le ratio points/prix, les pépites et les performances en WT
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rankings.map((manager, idx) => (
          <div
            key={manager.manager_id}
            className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
          >
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
                <span>Score</span>
                <span className="font-bold text-foreground">{manager.knowledge_score}</span>
              </div>
              <div className="bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${manager.knowledge_score}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-xs">Ratio moy.</span>
                </div>
                <div className="font-semibold text-sm">{manager.avg_ratio}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Award className="h-3 w-3" />
                  <span className="text-xs">Pépites</span>
                </div>
                <div className="font-semibold text-sm">{manager.pepites_count}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Target className="h-3 w-3" />
                  <span className="text-xs">% WT</span>
                </div>
                <div className="font-semibold text-sm">{manager.wt_percentage}%</div>
              </div>
            </div>
          </div>
        ))}

        {/* Summary */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">🏆 Le plus futé</div>
              <div className="font-semibold text-lg">{rankings[0]?.manager_nom || '-'}</div>
              <div className="text-xs text-muted-foreground">
                Score: {rankings[0]?.knowledge_score || 0}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Score moyen</div>
              <div className="font-semibold text-lg">{avgScore}</div>
              <div className="text-xs text-muted-foreground">
                {rankings.length} managers
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Pépites totales</div>
              <div className="font-semibold text-lg">{totalPepites}</div>
              <div className="text-xs text-muted-foreground">
                Moy: {rankings.length > 0 ? Math.round(totalPepites / rankings.length * 10) / 10 : 0}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

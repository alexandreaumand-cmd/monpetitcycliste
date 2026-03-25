import { useState } from "react";
import { useLuckRanking } from "@/hooks/useLuckRanking";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clover, TrendingUp, Zap, Target, ChevronDown, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/contexts/LeagueContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface LuckRankingProps {
  saisonId: string;
}

export const LuckRanking = ({ saisonId }: LuckRankingProps) => {
  const { t } = useTranslation('statistics');
  const { leagueId } = useLeague();
  const { data, isLoading } = useLuckRanking(saisonId, leagueId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    ? Math.round(rankings.reduce((sum: number, r: any) => sum + r.performance_gap, 0) / rankings.length * 10) / 10
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clover className="h-6 w-6 text-green-500" />
          {t('luck.title')}
        </CardTitle>
        <CardDescription>
          {t('luck.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rankings.map((manager: any, idx: number) => {
          const isExpanded = expandedId === manager.manager_id;

          return (
            <Collapsible
              key={manager.manager_id}
              open={isExpanded}
              onOpenChange={(open) => setExpandedId(open ? manager.manager_id : null)}
            >
              <CollapsibleTrigger asChild>
                <div
                  className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors relative cursor-pointer"
                >
                  {/* Special badges */}
                  {idx === 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-500">
                      {t('luck.luckiestBadge')}
                    </Badge>
                  )}
                  {idx === rankings.length - 1 && rankings.length > 1 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2">
                      {t('luck.unluckiestBadge')}
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
                      <span>{t('luck.luckScore')}</span>
                      <span className="font-bold text-foreground">{manager.luck_score}</span>
                    </div>
                    <div className="bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-bordure-gold transition-all duration-500"
                        style={{ width: `${manager.luck_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span className="text-xs">{t('luck.perfGap')}</span>
                      </div>
                      <div className={`font-semibold text-sm ${manager.performance_gap > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {manager.performance_gap > 0 ? '+' : ''}{manager.performance_gap}%
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Zap className="h-3 w-3" />
                        <span className="text-xs">{t('luck.variance')}</span>
                      </div>
                      <div className="font-semibold text-sm">{manager.variance}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Target className="h-3 w-3" />
                        <span className="text-xs">{t('luck.bigWins')}</span>
                      </div>
                      <div className="font-semibold text-sm">{manager.big_wins_ratio}%</div>
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronDown className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180"
                  )} />
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="ml-12 mr-4 mt-2 mb-2 p-4 border rounded-lg bg-muted/30 space-y-4">
                  {/* Points summary */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('luck.expectedPoints')}</span>
                      <span className="ml-2 font-semibold">{manager.expected_points?.toLocaleString()} pts</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('luck.actualPoints')}</span>
                      <span className="ml-2 font-semibold">{manager.actual_points?.toLocaleString()} pts</span>
                    </div>
                  </div>

                  {/* Big wins detail */}
                  {manager.big_wins_details && manager.big_wins_details.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                        <Trophy className="h-4 w-4 text-bordure-gold" />
                        {t('luck.bigWinsDetail')} ({manager.big_wins_details.length})
                      </h4>
                      <div className="space-y-1">
                        {manager.big_wins_details.map((bw: any) => (
                          <div key={bw.course_id} className="flex justify-between items-center text-sm py-1 px-2 rounded bg-green-500/10">
                            <span>{bw.course_nom}</span>
                            <span className="font-semibold text-green-500">{bw.points} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top courses */}
                  {manager.course_breakdown && manager.course_breakdown.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">{t('luck.topCourses')}</h4>
                      <div className="space-y-1">
                        {manager.course_breakdown.map((cb: any) => (
                          <div key={cb.course_id} className="flex justify-between items-center text-sm py-1 px-2 rounded hover:bg-muted/50">
                            <span className="flex items-center gap-1">
                              {cb.is_big_win && <Target className="h-3 w-3 text-green-500" />}
                              {cb.course_nom}
                            </span>
                            <span className={cn("font-medium", cb.is_big_win && "text-green-500")}>
                              {cb.points} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Summary */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{t('luck.luckiest')}</div>
              <div className="font-semibold text-lg">{rankings[0]?.manager_nom || '-'}</div>
              <div className="text-xs text-muted-foreground">
                {t('luck.luckScore')}: {rankings[0]?.luck_score || 0}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{t('luck.unluckiest')}</div>
              <div className="font-semibold text-lg">{rankings[rankings.length - 1]?.manager_nom || '-'}</div>
              <div className="text-xs text-muted-foreground">
                {t('luck.luckScore')}: {rankings[rankings.length - 1]?.luck_score || 0}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{t('luck.avgGap')}</div>
              <div className={`font-semibold text-lg ${avgGap > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {avgGap > 0 ? '+' : ''}{avgGap}%
              </div>
              <div className="text-xs text-muted-foreground">
                {rankings.length} {t('luck.managers')}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

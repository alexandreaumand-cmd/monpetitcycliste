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
import { useIsMobile } from "@/hooks/use-mobile";

interface LuckRankingProps {
  saisonId: string;
}

export const LuckRanking = ({ saisonId }: LuckRankingProps) => {
  const { t } = useTranslation('statistics');
  const { leagueId } = useLeague();
  const { data, isLoading } = useLuckRanking(saisonId, leagueId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></CardHeader>
        <CardContent><div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div></CardContent>
      </Card>
    );
  }

  const rankings = data?.rankings || [];
  const avgGap = rankings.length > 0
    ? Math.round(rankings.reduce((sum: number, r: any) => sum + r.performance_gap, 0) / rankings.length * 10) / 10
    : 0;

  return (
    <Card>
      <CardHeader className={isMobile ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base md:text-xl">
          <Clover className="h-5 w-5 md:h-6 md:w-6 text-green-500" />
          {t('luck.title')}
        </CardTitle>
        {!isMobile && <CardDescription>{t('luck.description')}</CardDescription>}
      </CardHeader>
      <CardContent className={cn("space-y-3", isMobile && "pt-0")}>
        {rankings.map((manager: any, idx: number) => {
          const isExpanded = expandedId === manager.manager_id;

          return (
            <Collapsible
              key={manager.manager_id}
              open={isExpanded}
              onOpenChange={(open) => setExpandedId(open ? manager.manager_id : null)}
            >
              <CollapsibleTrigger asChild>
                <div className={cn(
                  "border rounded-lg bg-card hover:bg-accent/50 transition-colors relative cursor-pointer",
                  isMobile ? "p-2.5" : "flex items-center gap-4 p-4"
                )}>
                  {/* Badges */}
                  {idx === 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-[10px] md:text-xs">
                      {isMobile ? '🍀' : t('luck.luckiestBadge')}
                    </Badge>
                  )}
                  {idx === rankings.length - 1 && rankings.length > 1 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 text-[10px] md:text-xs">
                      {isMobile ? '💩' : t('luck.unluckiestBadge')}
                    </Badge>
                  )}

                  {isMobile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-muted-foreground">#{idx + 1}</span>
                          <span className="font-semibold text-sm truncate">{manager.manager_nom}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold">{manager.luck_score}</span>
                          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                        </div>
                      </div>
                      {/* Gauge */}
                      <div className="bg-muted rounded-full h-2.5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 to-bordure-gold transition-all duration-500" style={{ width: `${manager.luck_score}%` }} />
                      </div>
                      {/* Compact stats */}
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Écart: <span className={manager.performance_gap > 0 ? 'text-green-500' : 'text-red-500'}>{manager.performance_gap > 0 ? '+' : ''}{manager.performance_gap}%</span></span>
                        <span>Var: {manager.variance}</span>
                        <span>Gros coups: {manager.big_wins_ratio}%</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 text-center"><div className="font-bold text-2xl text-muted-foreground">#{idx + 1}</div></div>
                      <div className="flex-1 min-w-0"><div className="font-semibold text-lg truncate">{manager.manager_nom}</div></div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{t('luck.luckScore')}</span>
                          <span className="font-bold text-foreground">{manager.luck_score}</span>
                        </div>
                        <div className="bg-muted rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-500 to-bordure-gold transition-all duration-500" style={{ width: `${manager.luck_score}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground"><TrendingUp className="h-3 w-3" /><span className="text-xs">{t('luck.perfGap')}</span></div>
                          <div className={`font-semibold text-sm ${manager.performance_gap > 0 ? 'text-green-500' : 'text-red-500'}`}>{manager.performance_gap > 0 ? '+' : ''}{manager.performance_gap}%</div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground"><Zap className="h-3 w-3" /><span className="text-xs">{t('luck.variance')}</span></div>
                          <div className="font-semibold text-sm">{manager.variance}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground"><Target className="h-3 w-3" /><span className="text-xs">{t('luck.bigWins')}</span></div>
                          <div className="font-semibold text-sm">{manager.big_wins_ratio}%</div>
                        </div>
                      </div>
                      <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                    </>
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className={cn("mt-2 mb-2 p-3 md:p-4 border rounded-lg bg-muted/30 space-y-3", isMobile ? "mx-1" : "ml-12 mr-4")}>
                  <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('luck.expectedPoints')}</span>
                      <span className="ml-1 font-semibold">{manager.expected_points?.toLocaleString()} pts</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('luck.actualPoints')}</span>
                      <span className="ml-1 font-semibold">{manager.actual_points?.toLocaleString()} pts</span>
                    </div>
                  </div>

                  {manager.big_wins_details && manager.big_wins_details.length > 0 && (
                    <div>
                      <h4 className="text-xs md:text-sm font-semibold flex items-center gap-1 mb-1.5">
                        <Trophy className="h-3.5 w-3.5 text-bordure-gold" />
                        {t('luck.bigWinsDetail')} ({manager.big_wins_details.length})
                      </h4>
                      <div className="space-y-1">
                        {manager.big_wins_details.map((bw: any) => (
                          <div key={bw.course_id} className="flex justify-between items-center text-xs py-1 px-2 rounded bg-green-500/10">
                            <span className="truncate mr-2">{bw.course_nom}</span>
                            <span className="font-semibold text-green-500 whitespace-nowrap">{bw.points} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {manager.course_breakdown && manager.course_breakdown.length > 0 && (
                    <div>
                      <h4 className="text-xs md:text-sm font-semibold mb-1.5">{t('luck.topCourses')}</h4>
                      <div className="space-y-0.5">
                        {manager.course_breakdown.map((cb: any) => (
                          <div key={cb.course_id} className="flex justify-between items-center text-xs py-1 px-2 rounded hover:bg-muted/50">
                            <span className="flex items-center gap-1 truncate mr-2">
                              {cb.is_big_win && <Target className="h-3 w-3 text-green-500 flex-shrink-0" />}
                              {cb.course_nom}
                            </span>
                            <span className={cn("font-medium whitespace-nowrap", cb.is_big_win && "text-green-500")}>{cb.points} pts</span>
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
        <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
          <div className="grid grid-cols-3 gap-2 md:gap-4 text-center text-xs md:text-base">
            <div className="space-y-0.5">
              <div className="text-[10px] md:text-sm text-muted-foreground">{t('luck.luckiest')}</div>
              <div className="font-semibold text-sm md:text-lg truncate">{rankings[0]?.manager_nom || '-'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] md:text-sm text-muted-foreground">{t('luck.unluckiest')}</div>
              <div className="font-semibold text-sm md:text-lg truncate">{rankings[rankings.length - 1]?.manager_nom || '-'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] md:text-sm text-muted-foreground">{t('luck.avgGap')}</div>
              <div className={`font-semibold text-sm md:text-lg ${avgGap > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {avgGap > 0 ? '+' : ''}{avgGap}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

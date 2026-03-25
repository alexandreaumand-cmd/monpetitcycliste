import { useState } from "react";
import { useKnowledgeRanking } from "@/hooks/useKnowledgeRanking";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Award, Target, ChevronDown, ChevronUp, Gem } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface Rider {
  nom: string;
  prix_signature: number;
  points: number;
  ratio: number;
  is_pepite: boolean;
}

interface BikeKnowledgeRankingProps {
  saisonId: string;
}

export const BikeKnowledgeRanking = ({ saisonId }: BikeKnowledgeRankingProps) => {
  const { t } = useTranslation('statistics');
  const { leagueId } = useLeague();
  const { data, isLoading } = useKnowledgeRanking(saisonId, leagueId);
  const isMobile = useIsMobile();
  const [expandedManager, setExpandedManager] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></CardHeader>
        <CardContent><div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div></CardContent>
      </Card>
    );
  }

  const rankings = data?.rankings || [];
  const avgScore = rankings.length > 0 ? Math.round(rankings.reduce((sum: number, r: any) => sum + r.knowledge_score, 0) / rankings.length) : 0;
  const totalPepites = rankings.reduce((sum: number, r: any) => sum + r.pepites_count, 0);

  const toggleExpand = (managerId: string) => {
    setExpandedManager(prev => prev === managerId ? null : managerId);
  };

  return (
    <Card>
      <CardHeader className={isMobile ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base md:text-xl">
          <Brain className="h-5 w-5 md:h-6 md:w-6" />
          {t('knowledge.title')}
        </CardTitle>
        {!isMobile && <CardDescription>{t('knowledge.description')}</CardDescription>}
      </CardHeader>
      <CardContent className={cn("space-y-3 md:space-y-4", isMobile && "pt-0")}>
        {rankings.map((manager: any, idx: number) => {
          const isExpanded = expandedManager === manager.manager_id;
          const riders: Rider[] = manager.riders || [];

          return (
            <div
              key={manager.manager_id}
              className={cn(
                "border rounded-lg bg-card transition-colors",
                isMobile ? "" : ""
              )}
            >
              {/* Header row - clickable */}
              <div
                className={cn(
                  "cursor-pointer hover:bg-accent/50 transition-colors",
                  isMobile ? "p-2.5" : "flex items-center gap-4 p-4"
                )}
                onClick={() => toggleExpand(manager.manager_id)}
              >
                {isMobile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-muted-foreground">#{idx + 1}</span>
                        <span className="font-semibold text-sm truncate">{manager.manager_nom}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{manager.knowledge_score}</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 rounded-full"
                        style={{ width: `${manager.knowledge_score}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Ratio: <span className="text-foreground font-medium">{manager.avg_ratio}</span></span>
                      <span>Pépites: <span className="text-foreground font-medium">{manager.pepites_count}</span></span>
                      <span>WT: <span className="text-foreground font-medium">{manager.wt_percentage}%</span></span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 text-center"><div className="font-bold text-2xl text-muted-foreground">#{idx + 1}</div></div>
                    <div className="flex-1 min-w-0"><div className="font-semibold text-lg truncate">{manager.manager_nom}</div></div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t('knowledge.score')}</span>
                        <span className="font-bold text-foreground">{manager.knowledge_score}</span>
                      </div>
                      <div className="bg-muted rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500" style={{ width: `${manager.knowledge_score}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground"><TrendingUp className="h-3 w-3" /><span className="text-xs">{t('knowledge.avgRatio')}</span></div>
                        <div className="font-semibold text-sm">{manager.avg_ratio}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground"><Award className="h-3 w-3" /><span className="text-xs">{t('knowledge.pepites')}</span></div>
                        <div className="font-semibold text-sm">{manager.pepites_count}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground"><Target className="h-3 w-3" /><span className="text-xs">{t('knowledge.wtPercentage')}</span></div>
                        <div className="font-semibold text-sm">{manager.wt_percentage}%</div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </>
                )}
              </div>

              {/* Expandable rider details */}
              {isExpanded && riders.length > 0 && (
                <div className={cn("border-t", isMobile ? "p-2.5 pt-2" : "p-4 pt-3")}>
                  <div className={cn(
                    "rounded-md border overflow-hidden",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {/* Table header */}
                    <div className={cn(
                      "grid bg-muted/50 font-medium text-muted-foreground border-b",
                      isMobile
                        ? "grid-cols-[1fr_40px_45px_45px] gap-1 px-2 py-1.5 text-[10px]"
                        : "grid-cols-[1fr_80px_80px_80px_80px] gap-2 px-3 py-2"
                    )}>
                      <span>Coureur</span>
                      <span className="text-right">Prix</span>
                      <span className="text-right">Pts</span>
                      <span className="text-right">Ratio</span>
                      {!isMobile && <span className="text-center">Statut</span>}
                    </div>
                    {/* Rider rows */}
                    {riders.map((rider: Rider, rIdx: number) => (
                      <div
                        key={rIdx}
                        className={cn(
                          "grid items-center border-b last:border-b-0 transition-colors",
                          rider.is_pepite ? "bg-yellow-500/5" : "hover:bg-accent/30",
                          isMobile
                            ? "grid-cols-[1fr_40px_45px_45px] gap-1 px-2 py-1.5 text-[11px]"
                            : "grid-cols-[1fr_80px_80px_80px_80px] gap-2 px-3 py-2"
                        )}
                      >
                        <span className={cn("truncate flex items-center gap-1", rider.is_pepite && "font-semibold")}>
                          {rider.is_pepite && <Gem className="h-3 w-3 text-yellow-500 shrink-0" />}
                          {rider.nom}
                        </span>
                        <span className="text-right text-muted-foreground">{rider.prix_signature}</span>
                        <span className="text-right font-medium">{rider.points}</span>
                        <span className={cn("text-right font-semibold", rider.ratio > 2.5 ? "text-green-600 dark:text-green-400" : "")}>
                          {rider.ratio}
                        </span>
                        {!isMobile && (
                          <span className="text-center">
                            {rider.is_pepite && (
                              <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 text-[10px] px-1.5">
                                Pépite
                              </Badge>
                            )}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Summary */}
        <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
          <div className="grid grid-cols-3 gap-2 md:gap-4 text-center text-xs md:text-base">
            <div className="space-y-0.5">
              <div className="text-[10px] md:text-sm text-muted-foreground">{t('knowledge.smartest')}</div>
              <div className="font-semibold text-sm md:text-lg truncate">{rankings[0]?.manager_nom || '-'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] md:text-sm text-muted-foreground">{t('knowledge.avgScore')}</div>
              <div className="font-semibold text-sm md:text-lg">{avgScore}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] md:text-sm text-muted-foreground">{t('knowledge.totalPepites')}</div>
              <div className="font-semibold text-sm md:text-lg">{totalPepites}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

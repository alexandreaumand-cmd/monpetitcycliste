import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PieChart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";

interface CategoryWeightProps {
  saisonId: string;
  leagueId?: string;
}

export const CategoryWeight = ({ saisonId, leagueId }: CategoryWeightProps) => {
  const { t } = useTranslation('statistics');
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ['team-category-stats', saisonId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-team-category-stats', {
        body: { saison_id: saisonId, league_id: leagueId }
      });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data?.categories?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('categoryWeight.title')}</CardTitle>
          <CardDescription>{t('categoryWeight.noData')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const activePhases = (data.phases || []).filter((p: any) => p.statut === 'active' || p.statut === 'completed');
  const totalAll = data.categories.reduce((sum: number, c: any) => sum + c.total, 0);

  const barColors = [
    'bg-primary',
    'bg-secondary',
    'bg-bordure-gold',
    'bg-muted-foreground',
    'bg-accent',
  ];

  return (
    <Card>
      <CardHeader className={isMobile ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base md:text-xl">
          <PieChart className="h-5 w-5" />
          {t('categoryWeight.title')}
        </CardTitle>
        {!isMobile && <CardDescription>{t('categoryWeight.description')}</CardDescription>}
      </CardHeader>
      <CardContent className={cn("space-y-4 md:space-y-6", isMobile && "pt-0")}>
        {/* Visual bar */}
        <div className="space-y-2">
          <div className="flex rounded-full h-5 md:h-6 overflow-hidden">
            {data.categories.map((cat: any, idx: number) => (
              <div
                key={cat.categorie}
                className={cn("h-full transition-all", barColors[idx % barColors.length])}
                style={{ width: `${cat.percentage}%` }}
                title={`${cat.categorie}: ${cat.percentage}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3 text-xs md:text-sm">
            {data.categories.map((cat: any, idx: number) => (
              <div key={cat.categorie} className="flex items-center gap-1">
                <div className={cn("w-2.5 h-2.5 md:w-3 md:h-3 rounded-full", barColors[idx % barColors.length])} />
                <span className="font-medium">{cat.categorie}</span>
                <span className="text-muted-foreground">({cat.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

        {isMobile ? (
          // Mobile: card-based
          <div className="space-y-2">
            {data.categories.map((cat: any, idx: number) => (
              <div key={cat.categorie} className="p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", barColors[idx % barColors.length])} />
                    <span className="font-semibold text-sm">{cat.categorie}</span>
                  </div>
                  <span className="font-bold text-primary text-sm">{cat.percentage}%</span>
                </div>
                <div className="bg-muted rounded-full h-2 overflow-hidden mb-2">
                  <div className={cn("h-full rounded-full", barColors[idx % barColors.length])} style={{ width: `${cat.percentage}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Total: <span className="text-foreground font-medium">{cat.total.toLocaleString()}</span></span>
                  {cat.phases.map((ph: any) => (
                    <span key={ph.phase_id}>P{ph.phase_index}: {ph.points > 0 ? ph.points.toLocaleString() : '—'}</span>
                  ))}
                </div>
              </div>
            ))}
            {/* Total */}
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <span className="text-xs text-muted-foreground">Total: </span>
              <span className="font-bold text-sm">{totalAll.toLocaleString()} pts</span>
            </div>
          </div>
        ) : (
          // Desktop: table
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold">{t('categoryWeight.category')}</th>
                  {activePhases.map((p: any) => (
                    <th key={p.id} className="text-center p-3 font-semibold">P{p.index}</th>
                  ))}
                  <th className="text-right p-3 font-semibold">{t('categoryWeight.total')}</th>
                  <th className="text-right p-3 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((cat: any) => (
                  <tr key={cat.categorie} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{cat.categorie}</td>
                    {cat.phases.map((ph: any) => (
                      <td key={ph.phase_id} className="text-center p-3">{ph.points > 0 ? ph.points.toLocaleString() : '—'}</td>
                    ))}
                    <td className="text-right p-3 font-bold">{cat.total.toLocaleString()}</td>
                    <td className="text-right p-3 font-bold text-primary">{cat.percentage}%</td>
                  </tr>
                ))}
                <tr className="bg-muted/50 font-bold">
                  <td className="p-3">{t('categoryWeight.total')}</td>
                  {activePhases.map((p: any) => {
                    const phaseTotal = data.categories.reduce((sum: number, c: any) => {
                      const ph = c.phases.find((pp: any) => pp.phase_id === p.id);
                      return sum + (ph?.points || 0);
                    }, 0);
                    return <td key={p.id} className="text-center p-3">{phaseTotal.toLocaleString()}</td>;
                  })}
                  <td className="text-right p-3">{totalAll.toLocaleString()}</td>
                  <td className="text-right p-3">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

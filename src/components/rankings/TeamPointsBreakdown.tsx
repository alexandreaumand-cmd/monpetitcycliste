import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Users, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface TeamPointsBreakdownProps {
  saisonId: string;
}

export const TeamPointsBreakdown = ({ saisonId }: TeamPointsBreakdownProps) => {
  const { t } = useTranslation('statistics');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['team-category-stats', saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-team-category-stats', {
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
        <CardHeader><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96" /></CardHeader>
        <CardContent><Skeleton className="h-96 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data?.teams?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('teams.title')}</CardTitle>
          <CardDescription>{t('teams.noData')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const maxTotal = data.teams[0]?.total || 1;
  const activePhases = (data.phases || []).filter((p: any) => p.statut === 'active' || p.statut === 'completed');

  const getCategoryColor = (cat: string) => {
    const lower = cat?.toLowerCase() || '';
    if (lower.includes('world') || lower === 'wt') return 'bg-primary text-primary-foreground';
    if (lower.includes('proteam') || lower.includes('pro team')) return 'bg-secondary text-secondary-foreground';
    if (lower.includes('continental') && !lower.includes('pro')) return 'bg-muted text-muted-foreground';
    return 'bg-accent text-accent-foreground';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t('teams.title')}
        </CardTitle>
        <CardDescription>{t('teams.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Header */}
        <div className="flex items-center gap-4 px-3 pb-2 text-xs text-muted-foreground font-medium border-b mb-2">
          <div className="w-8 text-center">#</div>
          <div className="flex-1">{t('teams.team')}</div>
          {activePhases.map((p: any) => (
            <div key={p.id} className="w-16 text-center">P{p.index}</div>
          ))}
          <div className="w-20 text-right">{t('teams.total')}</div>
          <div className="w-5" />
        </div>

        <div className="space-y-1">
          {data.teams.map((team: any, idx: number) => (
            <Collapsible
              key={team.equipe_id}
              open={expandedTeam === team.equipe_id}
              onOpenChange={(open) => setExpandedTeam(open ? team.equipe_id : null)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="w-8 text-center font-bold text-muted-foreground text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{team.nom}</div>
                    <Badge className={cn("text-[10px] mt-0.5", getCategoryColor(team.categorie))}>
                      {team.categorie}
                    </Badge>
                  </div>
                  {team.phases.map((ph: any) => (
                    <div key={ph.phase_id} className="w-16 text-center text-sm">
                      {ph.points > 0 ? ph.points.toLocaleString() : '—'}
                    </div>
                  ))}
                  <div className="w-20 text-right font-bold text-sm">
                    {team.total.toLocaleString()}
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    expandedTeam === team.equipe_id && "rotate-180"
                  )} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-12 mr-9 py-2 space-y-1">
                  {team.riders.map((rider: any) => (
                    <div key={rider.coureur_id} className="flex justify-between text-sm py-1 px-3 rounded hover:bg-muted/40">
                      <span className="text-muted-foreground">{rider.nom}</span>
                      <span className="font-medium">{rider.points.toLocaleString()} pts</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

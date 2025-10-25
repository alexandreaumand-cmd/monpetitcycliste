import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, TrendingUp, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type StatsResponse = {
  total_leagues: number;
  total_members: number;
  by_status: {
    active: number;
    pending: number;
    archived: number;
    completed: number;
  };
  by_game_mode: {
    full_season: number;
    short_gt: number;
    short_wt: number;
    short_classics: number;
  };
  recent_activity: {
    created_this_week: number;
    empty_leagues: number;
  };
};

export function SuperAdminLeaguesOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-leagues-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-leagues-stats");

      if (error) throw error;
      return data as StatsResponse;
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const kpis = [
    {
      title: "Ligues totales",
      value: stats.total_leagues,
      description: `${stats.by_status.active} actives • ${stats.by_status.pending} en attente`,
      icon: Shield,
      color: "text-primary",
    },
    {
      title: "Membres totaux",
      value: stats.total_members,
      description: "Joueurs uniques inscrits",
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Activité récente",
      value: stats.recent_activity.created_this_week,
      description: "Créées cette semaine",
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      title: "Attention requise",
      value: stats.recent_activity.empty_leagues,
      description: "Ligues sans membres",
      icon: AlertTriangle,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <Icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { CalendarDays } from "lucide-react";

interface WeeklyHeatmapProps {
  saisonId: string | null;
}

interface WeeklyRow {
  manager_id: string;
  manager_nom: string;
  week_number: number;
  total_points: number;
}

export const WeeklyHeatmap = ({ saisonId }: WeeklyHeatmapProps) => {
  const { t } = useTranslation("rankings");
  const { leagueId } = useLeague();

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["weekly-heatmap", leagueId, saisonId],
    enabled: !!leagueId && !!saisonId,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_weekly_points_heatmap", {
        p_league_id: leagueId!,
        p_saison_id: saisonId!,
      });
      if (error) throw error;
      return (data as WeeklyRow[]) || [];
    },
  });

  const { managers, weeks, cellMap, managerTotals } = useMemo(() => {
    if (!rawData || rawData.length === 0)
      return { managers: [], weeks: [], cellMap: new Map<string, number>(), managerTotals: new Map<string, number>() };

    // Collect unique weeks and managers
    const weekSet = new Set<number>();
    const managerMap = new Map<string, string>(); // id -> nom
    const cellMap = new Map<string, number>(); // `${managerId}_${week}` -> points
    const managerTotals = new Map<string, number>();

    for (const row of rawData) {
      weekSet.add(row.week_number);
      managerMap.set(row.manager_id, row.manager_nom);
      cellMap.set(`${row.manager_id}_${row.week_number}`, Number(row.total_points));
      managerTotals.set(
        row.manager_id,
        (managerTotals.get(row.manager_id) || 0) + Number(row.total_points)
      );
    }

    const weeks = Array.from(weekSet).sort((a, b) => a - b);

    // Sort managers by total points descending
    const managers = Array.from(managerMap.entries())
      .map(([id, nom]) => ({ id, nom }))
      .sort((a, b) => (managerTotals.get(b.id) || 0) - (managerTotals.get(a.id) || 0));

    return { managers, weeks, cellMap, managerTotals };
  }, [rawData]);

  // For each week, compute rankings and assign colors
  const getCellColor = (managerId: string, week: number): string => {
    const weekPoints: { id: string; pts: number }[] = managers.map((m) => ({
      id: m.id,
      pts: cellMap.get(`${m.id}_${week}`) || 0,
    }));

    // Sort descending by points
    const sorted = [...weekPoints].sort((a, b) => b.pts - a.pts);
    const rank = sorted.findIndex((s) => s.id === managerId) + 1;
    const total = sorted.length;
    const pts = cellMap.get(`${managerId}_${week}`) || 0;

    if (pts === 0) return "";

    if (rank === 1) return "bg-green-700 text-white font-bold";
    if (rank <= 3) return "bg-green-300 text-green-900 font-semibold";
    if (rank === total) return "bg-red-600 text-white font-bold";
    if (rank >= total - 1) return "bg-red-300 text-red-900 font-semibold";

    return "";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {t("weekly.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!rawData || rawData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {t("weekly.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t("weekly.noData")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          {t("weekly.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-background border-b border-r px-3 py-2 text-left font-medium text-muted-foreground min-w-[140px]">
                    {t("standings.manager")}
                  </th>
                  {weeks.map((w) => (
                    <th
                      key={w}
                      className="border-b px-2 py-2 text-center font-medium text-muted-foreground min-w-[56px]"
                    >
                      S{w}
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 bg-background border-b border-l px-3 py-2 text-center font-bold min-w-[64px]">
                    {t("weekly.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {managers.map((manager) => (
                  <tr key={manager.id} className="border-b last:border-b-0">
                    <td className="sticky left-0 z-10 bg-background border-r px-3 py-2 font-medium whitespace-nowrap">
                      {manager.nom}
                    </td>
                    {weeks.map((w) => {
                      const pts = cellMap.get(`${manager.id}_${w}`) || 0;
                      const color = getCellColor(manager.id, w);
                      return (
                        <td
                          key={w}
                          className={`px-2 py-2 text-center tabular-nums ${color}`}
                        >
                          {pts > 0 ? Math.round(pts) : ""}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 bg-background border-l px-3 py-2 text-center font-bold tabular-nums">
                      {Math.round(managerTotals.get(manager.id) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

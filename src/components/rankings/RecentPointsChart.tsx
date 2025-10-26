import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartConfig } from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { useLeague } from "@/contexts/LeagueContext";

interface RecentPointsChartProps {
  phaseId?: string | null;
  saisonId?: string | null;
  viewMode?: 'phase' | 'season' | 'current';
}

// Custom tooltip content that sorts managers by points
const SortedChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof ChartTooltipContent>
>((props, ref) => {
  const { payload, ...rest } = props;
  
  // Sort payload by value (descending)
  const sortedPayload = React.useMemo(() => {
    if (!payload) return payload;
    
    return [...payload].sort((a, b) => {
      const aValue = typeof a.value === 'number' ? a.value : 0;
      const bValue = typeof b.value === 'number' ? b.value : 0;
      return bValue - aValue; // Descending order
    });
  }, [payload]);

  return <ChartTooltipContent ref={ref} payload={sortedPayload} {...rest} />;
});
SortedChartTooltipContent.displayName = "SortedChartTooltipContent";

export const RecentPointsChart = ({ phaseId, saisonId, viewMode }: RecentPointsChartProps) => {
  const determinedViewMode = viewMode || (phaseId ? 'phase' : 'season');
  const { leagueId, isLoading: leagueLoading } = useLeague();

  const { data: seriesData, isLoading } = useQuery({
    queryKey: ["cumulative-points", phaseId, saisonId, determinedViewMode, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-cumulative-points-series", {
        body: { 
          view_mode: determinedViewMode,
          phase_id: phaseId || null,
          saison_id: saisonId || null,
          topN: 10,
          league_id: leagueId
        }
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !leagueLoading && !!leagueId,
  });

  // Filter out Unknown managers and transform data for recharts
  const filteredSeries = seriesData?.series?.filter((s: any) => s.manager_nom && s.manager_nom !== 'Unknown') || [];
  
  const chartData = filteredSeries?.[0]?.points
    ?.map((p: any) => {
      const dateObj = new Date(p.date);
      const formattedDate = format(dateObj, "dd MMM", { locale: fr });
      const dataPoint: any = { date: formattedDate, fullDate: p.date };
      
      filteredSeries.forEach((s: any) => {
        const point = s.points.find((pt: any) => pt.date === p.date);
        dataPoint[s.manager_nom] = point?.value || 0;
      });
      
      return dataPoint;
    })
    .sort((a: any, b: any) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()) || [];

  const managers = filteredSeries.map((s: any) => s.manager_nom);
  
  // Palette optimisée pour contraste maximum entre couleurs adjacentes
  const colors = [
    "hsl(210, 100%, 50%)",   // Bleu vif
    "hsl(0, 85%, 55%)",      // Rouge vif
    "hsl(120, 85%, 35%)",    // Vert foncé
    "hsl(280, 90%, 55%)",    // Violet
    "hsl(35, 100%, 50%)",    // Orange
    "hsl(340, 90%, 50%)",    // Rose fuchsia
    "hsl(180, 80%, 40%)",    // Cyan
    "hsl(50, 100%, 45%)",    // Jaune moutarde
    "hsl(160, 70%, 45%)",    // Vert émeraude
    "hsl(25, 95%, 55%)",     // Orange brûlé
    "hsl(190, 85%, 45%)",    // Bleu turquoise
    "hsl(300, 75%, 50%)",    // Magenta
    "hsl(90, 70%, 40%)",     // Vert lime
    "hsl(15, 85%, 55%)",     // Rouge orangé
    "hsl(240, 80%, 60%)",    // Bleu indigo
  ];
  
  // Build ChartConfig avec attribution séquentielle des couleurs
  const chartConfig: ChartConfig = managers.reduce((config, manager, index) => {
    const colorIndex = index % colors.length;
    config[manager] = {
      label: manager,
      color: colors[colorIndex],
    };
    return config;
  }, {} as ChartConfig);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Évolution des points
        </CardTitle>
        <CardDescription>
          Points cumulés {seriesData?.meta?.phase_info && `• Phase ${seriesData.meta.phase_info.index}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucune donnée pour la période sélectionnée
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <ChartTooltip content={<SortedChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent className="flex-wrap gap-2 text-xs" />} wrapperStyle={{ paddingTop: "20px" }} />
              {managers.map((manager) => (
                <Line
                  key={manager}
                  type="natural"
                  dataKey={manager}
                  stroke={chartConfig[manager]?.color || "hsl(var(--chart-1))"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

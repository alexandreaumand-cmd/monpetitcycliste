import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartConfig } from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";

interface RecentPointsChartProps {
  phaseId?: string | null;
  saisonId?: string | null;
}

export const RecentPointsChart = ({ phaseId, saisonId }: RecentPointsChartProps) => {

  const { data: seriesData, isLoading } = useQuery({
    queryKey: ["cumulative-points", phaseId, saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-cumulative-points-series", {
        body: { 
          view_mode: phaseId ? 'phase' : 'season',
          phase_id: phaseId || null,
          saison_id: saisonId || null,
          topN: 10 
        }
      });
      
      if (error) throw error;
      return data;
    },
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
  
  // Fonction de hash stable pour assigner les couleurs selon le nom du manager
  const getColorIndex = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };
  
  // Build ChartConfig avec des couleurs stables par manager
  const chartConfig: ChartConfig = managers.reduce((config, manager) => {
    const colors = [
      "hsl(220, 70%, 50%)",  // blue
      "hsl(142, 71%, 45%)",  // green  
      "hsl(38, 92%, 50%)",   // amber
      "hsl(0, 72%, 51%)",    // red
      "hsl(258, 90%, 66%)",  // purple
      "hsl(330, 81%, 60%)",  // pink
      "hsl(280, 70%, 50%)",  // violet
      "hsl(160, 70%, 50%)",  // teal
      "hsl(25, 95%, 53%)",   // orange
      "hsl(340, 82%, 52%)"   // rose
    ];
    const colorIndex = getColorIndex(manager) % colors.length;
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
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent className="flex-wrap gap-2 text-xs" />} wrapperStyle={{ paddingTop: "20px" }} />
              {managers.map((manager) => (
                <Line
                  key={manager}
                  type="monotone"
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

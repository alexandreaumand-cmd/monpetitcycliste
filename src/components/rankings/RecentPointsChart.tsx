import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartConfig } from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { useSeasonContext } from "@/contexts/SeasonContext";

export const RecentPointsChart = () => {
  const { selectedSeason, phases } = useSeasonContext();
  const [viewMode, setViewMode] = useState<'current' | 'phase' | 'season'>('current');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  const { data: seriesData, isLoading } = useQuery({
    queryKey: ["cumulative-points", viewMode, selectedPhaseId, selectedSeason?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-cumulative-points-series", {
        body: { 
          view_mode: viewMode,
          phase_id: viewMode === 'phase' ? selectedPhaseId : null,
          saison_id: viewMode === 'season' ? selectedSeason?.id : null,
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
  
  // Build ChartConfig
  const chartConfig: ChartConfig = managers.reduce((config, manager, idx) => {
    const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))"];
    config[manager] = {
      label: manager,
      color: colors[idx % colors.length],
    };
    return config;
  }, {} as ChartConfig);
  
  const handleViewChange = (value: string) => {
    if (value === 'current') {
      setViewMode('current');
      setSelectedPhaseId(null);
    } else if (value === 'season') {
      setViewMode('season');
      setSelectedPhaseId(null);
    } else {
      setViewMode('phase');
      setSelectedPhaseId(value);
    }
  };

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

  const currentValue = viewMode === 'current' ? 'current' : viewMode === 'season' ? 'season' : selectedPhaseId || 'current';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Évolution des points
            </CardTitle>
            <CardDescription>
              Points cumulés {seriesData?.meta?.phase_info && `• Phase ${seriesData.meta.phase_info.index}`}
            </CardDescription>
          </div>
          <Select value={currentValue} onValueChange={handleViewChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Phase actuelle</SelectItem>
              <SelectItem value="season">Toute la saison</SelectItem>
              {phases?.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  Phase {phase.index_dans_saison}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucune donnée pour la période sélectionnée
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
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
              <ChartLegend content={<ChartLegendContent />} />
              {managers.map((manager) => (
                <Line
                  key={manager}
                  type="monotone"
                  dataKey={manager}
                  stroke={chartConfig[manager]?.color || "hsl(var(--chart-1))"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
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

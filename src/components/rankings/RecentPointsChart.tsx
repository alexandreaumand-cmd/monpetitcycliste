import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export const RecentPointsChart = () => {
  const [days, setDays] = useState<number>(30);

  const { data: seriesData, isLoading } = useQuery({
    queryKey: ["cumulative-points", days],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-cumulative-points-series", {
        body: { days, topN: 5 }
      });
      
      if (error) throw error;
      return data;
    },
  });

  // Transform data for recharts - sort by date ascending (oldest to newest)
  const chartData = seriesData?.series?.[0]?.points
    ?.map((p: any) => {
      const dateObj = new Date(p.date);
      const formattedDate = format(dateObj, "dd MMM", { locale: fr });
      const dataPoint: any = { date: formattedDate, fullDate: p.date };
      
      seriesData.series.forEach((s: any) => {
        const point = s.points.find((pt: any) => pt.date === p.date);
        dataPoint[s.manager_nom] = point?.value || 0;
      });
      
      return dataPoint;
    })
    .sort((a: any, b: any) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()) || [];

  const managers = seriesData?.series?.map((s: any) => s.manager_nom) || [];
  const colors = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Évolution des points
            </CardTitle>
            <CardDescription>Points cumulés</CardDescription>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="14">14 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs text-muted-foreground"
            />
            <YAxis className="text-xs text-muted-foreground" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            {managers.map((manager, idx) => (
              <Line
                key={manager}
                type="monotone"
                dataKey={manager}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        {chartData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucune donnée pour la période sélectionnée
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

type CumulativePointsChartProps = {
  phaseId?: string | null;
  saisonId?: string | null;
};

type PointData = {
  date: string;
  value: number;
};

type SeriesData = {
  manager_id: string;
  manager_nom: string;
  points: PointData[];
};

type CumulativeData = {
  meta: {
    start_date: string;
    end_date: string;
    managers: Array<{ id: string; nom: string }>;
  };
  series: SeriesData[];
};

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const CumulativePointsChart = ({ phaseId, saisonId }: CumulativePointsChartProps) => {
  const [range, setRange] = useState<'7d' | '30d' | '2m' | '6m' | 'ytd'>('30d');
  const [showFinalValues, setShowFinalValues] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["cumulative-points", phaseId, saisonId, range],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-cumulative-points-series', {
        body: {
          saison_id: saisonId,
          phase_id: phaseId,
          range,
          topN: 5,
        },
      });

      if (error) throw error;
      return data as CumulativeData;
    },
  });

  // Transform data for recharts
  const chartData = data?.series[0]?.points.map((_, idx) => {
    const point: any = {
      date: data.series[0].points[idx].date,
    };

    data.series.forEach((serie) => {
      point[serie.manager_nom] = serie.points[idx].value;
    });

    return point;
  }) || [];

  const handleExportCSV = () => {
    if (!data) return;

    const rows = [
      ['Date', ...data.series.map(s => s.manager_nom)],
      ...chartData.map(row => [
        row.date,
        ...data.series.map(s => row[s.manager_nom]?.toString() || '0')
      ])
    ];

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `points_cumules_${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return range === '7d' || range === '30d' 
        ? format(date, 'dd/MM')
        : format(date, 'dd MMM');
    } catch {
      return dateStr;
    }
  };

  const hasData = chartData.length > 0 && data?.series.some(s => 
    s.points.some(p => p.value > 0)
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
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
              Évolution Cumulative des Points
            </CardTitle>
            <CardDescription>
              Cumul des points au fil du temps pour les {data?.series.length || 0} meilleurs managers
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={(v: any) => setRange(v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 jours</SelectItem>
                <SelectItem value="30d">30 jours</SelectItem>
                <SelectItem value="2m">2 mois</SelectItem>
                <SelectItem value="6m">6 mois</SelectItem>
                <SelectItem value="ytd">Depuis le début de l'année</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!hasData}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            Aucun point sur cette période
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  className="text-xs"
                />
                <YAxis 
                  label={{ value: 'Points cumulés', angle: -90, position: 'insideLeft' }}
                  className="text-xs"
                />
                <Tooltip 
                  labelFormatter={formatDate}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => {
                    const serie = data.series.find(s => s.manager_nom === value);
                    const finalValue = serie?.points[serie.points.length - 1]?.value || 0;
                    return (
                      <span className="text-sm">
                        {value}
                        {showFinalValues && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({finalValue} pts)
                          </span>
                        )}
                      </span>
                    );
                  }}
                />
                {data?.series.map((serie, idx) => (
                  <Line
                    key={serie.manager_id}
                    type="monotone"
                    dataKey={serie.manager_nom}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            <div className="flex items-center justify-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFinalValues}
                  onChange={(e) => setShowFinalValues(e.target.checked)}
                  className="rounded border-input"
                />
                Afficher les totaux finaux
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

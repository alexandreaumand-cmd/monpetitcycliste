import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

interface PointsDistributionProps {
  saisonId: string;
}

interface PhaseStats {
  phase_id: string;
  phase_index: number;
  phase_label: string;
  stats: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    mean: number;
    std_dev: number;
    iqr: number;
    outliers_low: Array<{ manager_id: string; manager_nom: string; points: number }>;
    outliers_high: Array<{ manager_id: string; manager_nom: string; points: number }>;
  };
}

interface DistributionData {
  saison_id: string;
  phases: PhaseStats[];
  global_stats: {
    overall_min: number;
    overall_max: number;
    phases_count: number;
  };
}

export function PointsDistribution({ saisonId }: PointsDistributionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["points-distribution", saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-points-distribution", {
        body: { saison_id: saisonId },
      });

      if (error) throw error;
      return data as DistributionData;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.phases || data.phases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribution des points</CardTitle>
          <CardDescription>Analyse statistique de la répartition des scores</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Aucune donnée de distribution disponible pour cette saison
          </p>
        </CardContent>
      </Card>
    );
  }

  // Préparer les données pour le Box Plot (via BarChart empilé)
  const chartData = data.phases.map((phase) => ({
    name: phase.phase_label,
    lowerWhisker: phase.stats.min,
    lowerBox: phase.stats.q1 - phase.stats.min,
    iqr: phase.stats.q3 - phase.stats.q1,
    upperBox: phase.stats.max - phase.stats.q3,
    median: phase.stats.median,
    mean: phase.stats.mean,
    std_dev: phase.stats.std_dev,
    outliers_high: phase.stats.outliers_high,
    outliers_low: phase.stats.outliers_low,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const min = data.lowerWhisker;
    const max = min + data.lowerBox + data.iqr + data.upperBox;

    return (
      <div className="bg-background border border-border rounded-lg p-4 shadow-lg">
        <p className="font-semibold mb-2">{data.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Min:</span>
            <span className="font-medium">{min} pts</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Q1 (25%):</span>
            <span className="font-medium">{min + data.lowerBox} pts</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Médiane:</span>
            <span className="font-medium">{data.median} pts</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Moyenne:</span>
            <span className="font-medium">{data.mean} pts</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Q3 (75%):</span>
            <span className="font-medium">{min + data.lowerBox + data.iqr} pts</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Max:</span>
            <span className="font-medium">{max} pts</span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t border-border">
            <span className="text-muted-foreground">Écart-type:</span>
            <span className="font-medium">{data.std_dev} pts</span>
          </div>
          {data.outliers_high.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Outliers (hauts):</p>
              {data.outliers_high.map((o: any) => (
                <p key={o.manager_id} className="text-xs flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  {o.manager_nom}: {o.points} pts
                </p>
              ))}
            </div>
          )}
          {data.outliers_low.length > 0 && (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-1">Outliers (bas):</p>
              {data.outliers_low.map((o: any) => (
                <p key={o.manager_id} className="text-xs flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  {o.manager_nom}: {o.points} pts
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribution des points par phase</CardTitle>
        <CardDescription>
          Analyse statistique de la répartition des scores (box plots) - Les boîtes montrent Q1, médiane et Q3
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis dataKey="name" />
              <YAxis 
                label={{ value: 'Points', angle: -90, position: 'insideLeft' }}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Barre empilée pour créer l'effet box plot */}
              {/* Partie inférieure (min → Q1) - transparent */}
              <Bar dataKey="lowerWhisker" stackId="a" fill="transparent" />
              
              {/* Lower box (Q1 → médiane) */}
              <Bar dataKey="lowerBox" stackId="a" fill="hsl(var(--primary) / 0.3)" />
              
              {/* IQR (Q1 → Q3) - partie principale */}
              <Bar dataKey="iqr" stackId="a" fill="hsl(var(--primary) / 0.6)" radius={[4, 4, 0, 0]} />
              
              {/* Upper box (Q3 → max) */}
              <Bar dataKey="upperBox" stackId="a" fill="hsl(var(--primary) / 0.3)" />

              {/* Ligne médiane */}
              {chartData.map((entry, index) => (
                <ReferenceLine
                  key={`median-${index}`}
                  y={entry.median}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  segment={[
                    { x: index - 0.2, y: entry.median },
                    { x: index + 0.2, y: entry.median }
                  ]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Score minimum global</p>
            <p className="text-2xl font-bold">{data.global_stats.overall_min} pts</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Score maximum global</p>
            <p className="text-2xl font-bold">{data.global_stats.overall_max} pts</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Phases analysées</p>
            <p className="text-2xl font-bold">{data.global_stats.phases_count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

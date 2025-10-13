import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Minus, Eye } from "lucide-react";

interface ManagerPredictionsProps {
  saisonId: string;
}

interface Regression {
  slope: number;
  intercept: number;
  r_squared: number;
  interpretation: string;
  icon: string;
  color: string;
  confidence: string;
}

interface ManagerPrediction {
  manager_id: string;
  manager_nom: string;
  historical_points: Array<{ phase_index: number; points: number }>;
  regression: Regression;
  predictions: Array<{ phase_index: number; predicted_points: number }>;
  total_predicted: number;
  current_rank: number;
  predicted_rank: number;
}

interface PredictionsData {
  saison_id: string;
  predictions: ManagerPrediction[];
  meta: {
    completed_phases: number;
    remaining_phases: number;
    total_phases: number;
  };
}

export function ManagerPredictions({ saisonId }: ManagerPredictionsProps) {
  const [selectedManager, setSelectedManager] = useState<ManagerPrediction | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["manager-predictions", saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-predictions", {
        body: { saison_id: saisonId },
      });

      if (error) throw error;
      return data as PredictionsData;
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
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.predictions || data.predictions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prédictions & tendances</CardTitle>
          <CardDescription>Projections basées sur la régression linéaire</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Pas assez de données pour générer des prédictions (minimum 2 phases complètes requises)
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (icon: string) => {
    if (icon === "📈") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (icon === "📉") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  const getTrendColor = (color: string) => {
    if (color === "green") return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
    if (color === "red") return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
    return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
  };

  const getConfidenceColor = (confidence: string) => {
    if (confidence === "Haute") return "bg-green-500/10 text-green-700 dark:text-green-400";
    if (confidence === "Moyenne") return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    return "bg-red-500/10 text-red-700 dark:text-red-400";
  };

  const getRankChange = (pred: ManagerPrediction) => {
    const change = pred.current_rank - pred.predicted_rank;
    if (change > 0) return `+${change}`;
    if (change < 0) return change.toString();
    return "=";
  };

  const getRankChangeColor = (pred: ManagerPrediction) => {
    const change = pred.current_rank - pred.predicted_rank;
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Prédictions & tendances</CardTitle>
          <CardDescription>
            Projections basées sur la régression linéaire des performances passées ({data.meta.completed_phases} phases complètes)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.predictions.map((pred, index) => (
              <div
                key={pred.manager_id}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                      <div>
                        <h3 className="font-semibold text-lg">{pred.manager_nom}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={getTrendColor(pred.regression.color)}>
                            <span className="flex items-center gap-1">
                              {getTrendIcon(pred.regression.icon)}
                              {pred.regression.slope > 0 ? "+" : ""}{pred.regression.slope} pts/phase
                            </span>
                          </Badge>
                          <Badge variant="outline" className={getConfidenceColor(pred.regression.confidence)}>
                            R² = {pred.regression.r_squared.toFixed(2)} ({pred.regression.confidence})
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pred.regression.interpretation}
                    </p>
                  </div>

                  <div className="text-right space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Projection fin de saison</p>
                      <p className="text-2xl font-bold">{pred.total_predicted} pts</p>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <div className="text-xs text-muted-foreground">
                        {pred.current_rank}è → {pred.predicted_rank}è
                      </div>
                      <Badge variant="secondary" className={getRankChangeColor(pred)}>
                        {getRankChange(pred)}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedManager(pred)}
                    className="mt-4"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Détails
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {data.meta.remaining_phases > 0 && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> {data.meta.remaining_phases} phase(s) restante(s) à jouer. 
                Les prédictions sont basées sur les tendances actuelles et peuvent évoluer.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedManager} onOpenChange={() => setSelectedManager(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedManager?.manager_nom} - Analyse prédictive détaillée</DialogTitle>
          </DialogHeader>

          {selectedManager && (
            <div className="space-y-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      ...selectedManager.historical_points.map(hp => ({
                        phase: hp.phase_index,
                        Historique: hp.points,
                        Régression: Math.round(selectedManager.regression.slope * hp.phase_index + selectedManager.regression.intercept),
                      })),
                      ...selectedManager.predictions.map(p => ({
                        phase: p.phase_index,
                        Prédiction: p.predicted_points,
                        Régression: Math.round(selectedManager.regression.slope * p.phase_index + selectedManager.regression.intercept),
                      }))
                    ]}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis 
                      dataKey="phase" 
                      label={{ value: 'Phase', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis label={{ value: 'Points', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    
                    {/* Ligne verticale séparant historique et prédictions */}
                    {selectedManager.predictions.length > 0 && (
                      <ReferenceLine
                        x={selectedManager.historical_points[selectedManager.historical_points.length - 1].phase_index + 0.5}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="3 3"
                      />
                    )}
                    
                    <Line 
                      type="monotone"
                      dataKey="Historique"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ r: 5, fill: "hsl(var(--primary))" }}
                      connectNulls={false}
                    />
                    <Line 
                      type="monotone"
                      dataKey="Régression"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Line 
                      type="monotone"
                      dataKey="Prédiction"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={{ r: 4, fill: "hsl(var(--chart-3))" }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Tendance</p>
                  <p className="text-xl font-bold">
                    {selectedManager.regression.slope > 0 ? "+" : ""}{selectedManager.regression.slope} pts/phase
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedManager.regression.interpretation}</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Confiance (R²)</p>
                  <p className="text-xl font-bold">{Math.round(selectedManager.regression.r_squared * 100)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedManager.regression.confidence}</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Projection totale</p>
                  <p className="text-xl font-bold">{selectedManager.total_predicted} pts</p>
                  <p className="text-xs text-muted-foreground mt-1">Fin de saison</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Rang prédit</p>
                  <p className="text-xl font-bold">{selectedManager.predicted_rank}è</p>
                  <p className={`text-xs mt-1 ${getRankChangeColor(selectedManager)}`}>
                    {getRankChange(selectedManager)} place(s)
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

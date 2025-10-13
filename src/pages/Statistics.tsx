import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { BarChart3 } from "lucide-react";
import { PerformanceHeatmap } from "@/components/rankings/PerformanceHeatmap";
import { ConsistencyScores } from "@/components/rankings/ConsistencyScores";

const Statistics = () => {
  const { selectedSeason, setSelectedSeason, seasons, isLoading } = useSeasonContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!selectedSeason) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Aucune saison sélectionnée</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Statistiques avancées
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyses approfondies des performances et de la régularité des managers
          </p>
        </div>
        {seasons.length > 0 && (
          <Select
            value={selectedSeason.id}
            onValueChange={(value) => {
              const season = seasons.find(s => s.id === value);
              setSelectedSeason(season || null);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Saison" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={season.id}>
                  {season.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="heatmap" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="heatmap">Heatmap performances</TabsTrigger>
          <TabsTrigger value="consistency">Consistency score</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="mt-6">
          <PerformanceHeatmap saisonId={selectedSeason.id} />
        </TabsContent>

        <TabsContent value="consistency" className="mt-6">
          <ConsistencyScores saisonId={selectedSeason.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Statistics;

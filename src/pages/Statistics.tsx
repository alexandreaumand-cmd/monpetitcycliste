import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import { BarChart3 } from "lucide-react";
import { PerformanceHeatmap } from "@/components/rankings/PerformanceHeatmap";
import { ConsistencyScores } from "@/components/rankings/ConsistencyScores";
import { PointsDistribution } from "@/components/rankings/PointsDistribution";
import { ManagerPredictions } from "@/components/rankings/ManagerPredictions";
import { BikeKnowledgeRanking } from "@/components/rankings/BikeKnowledgeRanking";
import { LuckRanking } from "@/components/rankings/LuckRanking";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

const Statistics = () => {
  const { selectedSeason, setSelectedSeason, seasons, isLoading } = useSeasonContext();
  const { leagueId } = useLeague();

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
    <PageContainer>
      <PageHeader
        icon={BarChart3}
        title="Statistiques avancées"
        subtitle="Analyses approfondies des performances et de la régularité des managers"
        actions={
          !leagueId && seasons.length > 0 && (
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
          )
        }
      />

      <Tabs defaultValue="heatmap" className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-6">
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="consistency">Consistency</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="predictions">Prédictions</TabsTrigger>
          <TabsTrigger value="knowledge">🧠 Connaissance</TabsTrigger>
          <TabsTrigger value="luck">🍀 La Chatte</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="mt-6">
          <PerformanceHeatmap saisonId={selectedSeason.id} />
        </TabsContent>

        <TabsContent value="consistency" className="mt-6">
          <ConsistencyScores saisonId={selectedSeason.id} />
        </TabsContent>

        <TabsContent value="distribution" className="mt-6">
          <PointsDistribution saisonId={selectedSeason.id} />
        </TabsContent>

        <TabsContent value="predictions" className="mt-6">
          <ManagerPredictions saisonId={selectedSeason.id} />
        </TabsContent>

        <TabsContent value="knowledge" className="mt-6">
          <BikeKnowledgeRanking saisonId={selectedSeason.id} />
        </TabsContent>

        <TabsContent value="luck" className="mt-6">
          <LuckRanking saisonId={selectedSeason.id} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default Statistics;

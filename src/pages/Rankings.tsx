import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { ManagerStandings } from "@/components/rankings/ManagerStandings";
import { TopRiders } from "@/components/rankings/TopRiders";
import { ManagerBreakdown } from "@/components/rankings/ManagerBreakdown";
import { RecentPointsChart } from "@/components/rankings/RecentPointsChart";
import { RankingsKPIs } from "@/components/rankings/RankingsKPIs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TeamScoring } from "@/components/rankings/TeamScoring";
import { CourseLeaderboard } from "@/components/rankings/CourseLeaderboard";
import { ManagerHistory } from "@/components/rankings/ManagerHistory";
import { ManagerComparison } from "@/components/rankings/ManagerComparison";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { RankingsMobile } from "./Rankings.mobile";

export default function Rankings() {
  const isMobile = useIsMobile();
  const { selectedSeason, phases } = useSeasonContext();
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleManagerClick = (managerId: string) => {
    setSelectedManager(managerId);
    setDetailsOpen(true);
  };

  // ✅ Render mobile version AFTER all hooks
  if (isMobile) {
    return <RankingsMobile />;
  }

  // Desktop version

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Main Content */}
        <Tabs defaultValue="standings" className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <TabsList className="grid w-full grid-cols-7 max-w-5xl">
              <TabsTrigger value="standings">Managers</TabsTrigger>
              <TabsTrigger value="riders">Top Coureurs</TabsTrigger>
              <TabsTrigger value="timeline">Chronologie</TabsTrigger>
              <TabsTrigger value="team">Détail par équipe</TabsTrigger>
              <TabsTrigger value="course">Par course</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
              <TabsTrigger value="comparison">Comparaison</TabsTrigger>
            </TabsList>
            
            <Select 
              value={selectedPhase || "all"} 
              onValueChange={(v) => setSelectedPhase(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-56 shrink-0">
                <SelectValue placeholder="Général (toute la saison)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Général (toute la saison)</SelectItem>
                {phases?.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    Phase {phase.index_dans_saison}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="standings" className="space-y-4">
            <ManagerStandings 
              phaseId={selectedPhase} 
              onManagerClick={handleManagerClick}
            />
          </TabsContent>

          <TabsContent value="riders" className="space-y-4">
            <TopRiders phaseId={selectedPhase} saisonId={selectedSeason?.id || null} limit={20} />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <RecentPointsChart />
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <TeamScoring phaseId={selectedPhase} saisonId={selectedSeason?.id || null} />
          </TabsContent>

          <TabsContent value="course" className="space-y-4">
            <CourseLeaderboard phaseId={selectedPhase} saisonId={selectedSeason?.id || null} />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ManagerHistory phaseId={selectedPhase} saisonId={selectedSeason?.id || null} />
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            <ManagerComparison phaseId={selectedPhase} saisonId={selectedSeason?.id || null} />
          </TabsContent>
        </Tabs>

        {/* KPIs Section */}
        <section aria-labelledby="kpi-section-title" className="mt-8">
          <h2 id="kpi-section-title" className="sr-only">Aperçu des points</h2>
          <RankingsKPIs phaseId={selectedPhase} />
        </section>

        {/* Manager Details Drawer */}
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Détails Manager</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {selectedManager && <ManagerBreakdown managerId={selectedManager} phaseId={selectedPhase} />}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

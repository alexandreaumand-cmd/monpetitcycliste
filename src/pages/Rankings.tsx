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

export default function Rankings() {
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: phases } = useQuery({
    queryKey: ["phases-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phases")
        .select("id, index_dans_saison, date_debut, date_fin")
        .order("date_debut", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const handleManagerClick = (managerId: string) => {
    setSelectedManager(managerId);
    setDetailsOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-none shadow-card">
          <CardHeader className="pb-4 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  Classements
                </CardTitle>
                <CardDescription className="text-base">
                  Suivez les performances des managers et coureurs
                </CardDescription>
              </div>
              <Select 
                value={selectedPhase || "all"} 
                onValueChange={(v) => setSelectedPhase(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Toutes phases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes phases</SelectItem>
                  {phases?.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      Phase {phase.index_dans_saison}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
      </Card>

      {/* KPIs Section */}
      <section aria-labelledby="kpi-section-title">
        <h2 id="kpi-section-title" className="sr-only">Aperçu des points</h2>
        <RankingsKPIs phaseId={selectedPhase} />
      </section>

      {/* Main Content */}
      <Tabs defaultValue="standings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="standings">Classement</TabsTrigger>
            <TabsTrigger value="riders">Top Coureurs</TabsTrigger>
            <TabsTrigger value="timeline">Chronologie</TabsTrigger>
            <TabsTrigger value="team">Détail par équipe</TabsTrigger>
            <TabsTrigger value="course">Par course</TabsTrigger>
          </TabsList>

          <TabsContent value="standings" className="space-y-4">
            <ManagerStandings 
              phaseId={selectedPhase} 
              onManagerClick={handleManagerClick}
            />
          </TabsContent>

          <TabsContent value="riders" className="space-y-4">
            <TopRiders phaseId={selectedPhase} limit={20} />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <RecentPointsChart />
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <TeamScoring phaseId={selectedPhase} saisonId={null} />
          </TabsContent>

          <TabsContent value="course" className="space-y-4">
            <CourseLeaderboard phaseId={selectedPhase} saisonId={null} />
          </TabsContent>
        </Tabs>


        {/* Manager Details Drawer */}
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Détails Manager</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {selectedManager && <ManagerBreakdown managerId={selectedManager} />}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

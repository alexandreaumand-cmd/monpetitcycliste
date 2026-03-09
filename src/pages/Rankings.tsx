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
import { ManagerComparison } from "@/components/rankings/ManagerComparison";
import { WeeklyHeatmap } from "@/components/rankings/WeeklyHeatmap";
import { MountainRoadStandings } from "@/components/rankings/MountainRoadStandings";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import { RankingsMobile } from "./Rankings.mobile";
import { useTranslation } from "react-i18next";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Rankings() {
  const { t } = useTranslation('rankings');
  const isMobile = useIsMobile();
  const { selectedSeason, phases } = useSeasonContext();
  const { leagueId } = useLeague();
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
    <PageContainer>
      {/* Main Content */}
      <Tabs defaultValue="standings" className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <TabsList className="flex w-full gap-1">
              <TabsTrigger value="standings">{t('tabs.managers')}</TabsTrigger>
              <TabsTrigger value="riders">{t('tabs.topRiders')}</TabsTrigger>
              <TabsTrigger value="weekly">{t('tabs.weekly')}</TabsTrigger>
              <TabsTrigger value="timeline">{t('tabs.timeline')}</TabsTrigger>
              <TabsTrigger value="comparison">{t('tabs.comparison')}</TabsTrigger>
            </TabsList>
            
            <Select 
              value={selectedPhase || "all"} 
              onValueChange={(v) => setSelectedPhase(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-40 shrink-0">
                <SelectValue placeholder={t('phase.global')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('phase.global')}</SelectItem>
                {phases?.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    P{phase.index_dans_saison}{phase.statut === 'active' ? ` ${t('phase.active')}` : ''}
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
            <RankingsKPIs phaseId={selectedPhase} />
          </TabsContent>

          <TabsContent value="riders" className="space-y-4">
            <TopRiders phaseId={selectedPhase} saisonId={selectedSeason?.id || null} limit={20} />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <RecentPointsChart 
              phaseId={selectedPhase} 
              saisonId={selectedSeason?.id || null}
              viewMode={selectedPhase ? 'phase' : 'season'}
            />
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            <WeeklyHeatmap saisonId={selectedSeason?.id || null} />
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            <ManagerComparison phaseId={selectedPhase} saisonId={selectedSeason?.id || null} />
          </TabsContent>
        </Tabs>


        {/* Manager Details Drawer */}
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t('standings.managerDetails')}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {selectedManager && <ManagerBreakdown managerId={selectedManager} phaseId={selectedPhase} />}
            </div>
          </SheetContent>
        </Sheet>
    </PageContainer>
  );
}

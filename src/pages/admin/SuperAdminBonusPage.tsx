import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminGuard } from "@/components/guards/SuperAdminGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, BarChart3, Trophy, Users, FileUp } from "lucide-react";
import { BonusOverviewTab } from "@/components/admin/bonus/BonusOverviewTab";
import { RiderBonusTab } from "@/components/admin/bonus/RiderBonusTab";
import { ManagerBonusTab } from "@/components/admin/bonus/ManagerBonusTab";
import { BonusImportTab } from "@/components/admin/bonus/BonusImportTab";

export function SuperAdminBonusPage() {
  const [selectedSaisonId, setSelectedSaisonId] = useState<string>("");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  // Fetch saisons
  const { data: saisons } = useQuery({
    queryKey: ["saisons-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .order("annee", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select most recent season
  useMemo(() => {
    if (saisons && saisons.length > 0 && !selectedSaisonId) {
      setSelectedSaisonId(saisons[0].id);
    }
  }, [saisons, selectedSaisonId]);

  // Fetch phases for selected season
  const { data: phases } = useQuery({
    queryKey: ["phases-list", selectedSaisonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phases")
        .select("id, index_dans_saison, statut")
        .eq("saison_id", selectedSaisonId)
        .order("index_dans_saison");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSaisonId,
  });

  // Auto-select "all phases" when season changes
  useMemo(() => {
    if (phases && phases.length > 0 && !selectedPhaseId) {
      setSelectedPhaseId("all");
    }
  }, [phases, selectedPhaseId]);

  // Fetch leagues (all leagues for superadmin view)
  const { data: leagues } = useQuery({
    queryKey: ["all-leagues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leagues")
        .select("id, name, status")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Reset phase when season changes
  const handleSaisonChange = (saisonId: string) => {
    setSelectedSaisonId(saisonId);
    setSelectedPhaseId("");
  };

  // Reset league when phase changes
  const handlePhaseChange = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
  };

  const selectedSaison = saisons?.find(s => s.id === selectedSaisonId);
  const selectedPhase = phases?.find(p => p.id === selectedPhaseId);

  return (
    <SuperAdminGuard>
      <div className="space-y-6 p-3 sm:p-0">
        <PageHeader
          icon={Gift}
          title="Gestion des Bonus"
          subtitle="Attribution et récapitulatif des bonus par saison, phase et ligue"
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Season Filter */}
              <div className="space-y-2">
                <Label>Saison *</Label>
                <Select value={selectedSaisonId} onValueChange={handleSaisonChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une saison" />
                  </SelectTrigger>
                  <SelectContent>
                    {saisons?.map((saison) => (
                      <SelectItem key={saison.id} value={saison.id}>
                        {saison.annee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Phase Filter */}
              <div className="space-y-2">
                <Label>Phase *</Label>
                <Select 
                  value={selectedPhaseId} 
                  onValueChange={handlePhaseChange}
                  disabled={!selectedSaisonId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les phases</SelectItem>
                    {phases?.map((phase) => (
                      <SelectItem key={phase.id} value={phase.id}>
                        Phase {phase.index_dans_saison} {phase.statut === 'active' && "🔵"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* League Filter (Optional) */}
              <div className="space-y-2">
                <Label>Ligue (optionnel)</Label>
                <Select 
                  value={selectedLeagueId} 
                  onValueChange={setSelectedLeagueId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les ligues" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les ligues</SelectItem>
                    {leagues?.map((league) => (
                      <SelectItem key={league.id} value={league.id}>
                        {league.name} {league.status === 'active' && "✅"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        {selectedSaisonId && selectedPhaseId ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Récapitulatif</span>
              </TabsTrigger>
              <TabsTrigger value="rider" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Bonus Coureur</span>
              </TabsTrigger>
              <TabsTrigger value="manager" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Bonus Manager</span>
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <FileUp className="h-4 w-4" />
                <span className="hidden sm:inline">Import CSV</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              <BonusOverviewTab 
                phaseId={selectedPhaseId === "all" ? undefined : selectedPhaseId}
                leagueId={selectedLeagueId === "all" ? undefined : selectedLeagueId}
                saisonId={selectedSaisonId}
              />
            </TabsContent>

            <TabsContent value="rider" className="space-y-6 mt-6">
              <RiderBonusTab 
                phaseId={selectedPhaseId === "all" ? undefined : selectedPhaseId}
                saisonId={selectedSaisonId}
              />
            </TabsContent>

            <TabsContent value="manager" className="space-y-6 mt-6">
              <ManagerBonusTab 
                phaseId={selectedPhaseId === "all" ? undefined : selectedPhaseId}
                leagueId={selectedLeagueId === "all" ? undefined : selectedLeagueId}
                saisonId={selectedSaisonId}
              />
            </TabsContent>

            <TabsContent value="import" className="space-y-6 mt-6">
              <BonusImportTab 
                phaseId={selectedPhaseId === "all" ? undefined : selectedPhaseId}
                saisonId={selectedSaisonId}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Sélectionnez une saison et une phase pour voir et gérer les bonus
            </CardContent>
          </Card>
        )}
      </div>
    </SuperAdminGuard>
  );
}

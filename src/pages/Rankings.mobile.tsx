import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChipGroup } from "@/components/mobile/ChipGroup";
import { MobileCard } from "@/components/mobile/MobileCard";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { MobileEmptyState } from "@/components/mobile/MobileEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, User, TrendingUp, Shirt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { normalizeString } from "@/lib/stringUtils";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { ManagerBreakdown } from "@/components/rankings/ManagerBreakdown";
import { RiderPointsDetail } from "@/components/team/RiderPointsDetail";
import { RecentPointsChart } from "@/components/rankings/RecentPointsChart";
import { ManagerComparisonMobile } from "@/components/rankings/ManagerComparison.mobile";
import { ManagerPrestigeIcons } from "@/components/rankings/ManagerPrestigeIcons";

type TabView = "standings" | "riders" | "timeline" | "comparison" | "teams" | "courses";

export const RankingsMobile = () => {
  const { selectedSeason, phases } = useSeasonContext();
  const [activeTab, setActiveTab] = useState<TabView>("standings");
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [ridersDisplayLimit, setRidersDisplayLimit] = useState(20);
  const [riderSearchTerm, setRiderSearchTerm] = useState("");
  const [hideRidersWithoutManagers, setHideRidersWithoutManagers] = useState(false);
  const [selectedRider, setSelectedRider] = useState<{
    id: string;
    nom: string;
    equipe: string;
    prix: number;
  } | null>(null);
  const [riderDetailsOpen, setRiderDetailsOpen] = useState(false);

  // Fetch standings
  const { data: standings, isLoading: standingsLoading } = useQuery({
    queryKey: ["manager-standings-mobile", selectedPhase],
    queryFn: async () => {
      if (selectedPhase) {
        const { data, error } = await supabase
          .from("v_manager_standings_by_phase")
          .select("*")
          .eq("phase_id", selectedPhase)
          .order("total_points", { ascending: false });
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("v_manager_standings_total")
          .select("*")
          .order("total_points", { ascending: false });
        
        if (error) throw error;
        return data;
      }
    },
  });

  // Fetch previous standings for evolution
  const { data: previousStandings } = useQuery({
    queryKey: ["previous-manager-standings-mobile", selectedPhase],
    queryFn: async () => {
      if (!selectedPhase) {
        const { data: activePhase } = await supabase
          .from("phases")
          .select("id, index_dans_saison, saison_id")
          .eq("statut", "active")
          .order("index_dans_saison", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!activePhase || activePhase.index_dans_saison === 1) return null;
        
        const { data: completedPhases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", activePhase.saison_id)
          .eq("statut", "completed")
          .lt("index_dans_saison", activePhase.index_dans_saison);
        
        if (!completedPhases || completedPhases.length === 0) return null;
        
        const phaseIds = completedPhases.map(p => p.id);
        
        const { data: pointsData } = await supabase
          .from("points_ledger")
          .select("manager_id, points")
          .in("phase_id", phaseIds);
        
        if (!pointsData) return null;
        
        const managerPoints = new Map<string, number>();
        pointsData.forEach(row => {
          const current = managerPoints.get(row.manager_id) || 0;
          managerPoints.set(row.manager_id, current + (row.points || 0));
        });
        
        const sorted = Array.from(managerPoints.entries())
          .sort((a, b) => b[1] - a[1]);
        
        const rankMap = new Map<string, number>();
        sorted.forEach(([managerId], idx) => {
          rankMap.set(managerId, idx + 1);
        });
        
        return rankMap;
      } else {
        const { data: currentPhase } = await supabase
          .from("phases")
          .select("index_dans_saison, saison_id")
          .eq("id", selectedPhase)
          .single();

        if (!currentPhase || currentPhase.index_dans_saison <= 1) return null;

        const { data: prevPhase } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", currentPhase.saison_id)
          .eq("index_dans_saison", currentPhase.index_dans_saison - 1)
          .single();

        if (!prevPhase) return null;

        const { data, error } = await supabase
          .from("v_manager_standings_by_phase")
          .select("*")
          .eq("phase_id", prevPhase.id)
          .order("total_points", { ascending: false });

        if (error) return null;

        const rankMap = new Map();
        data?.forEach((standing, idx) => {
          rankMap.set(standing.manager_id, idx + 1);
        });

        return rankMap;
      }
    },
  });

  // Fetch top riders using edge function
  const { data: allTopRiders, isLoading: ridersLoading } = useQuery({
    queryKey: ["top-riders-mobile", selectedPhase, selectedSeason?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-top-riders', {
        body: {
          phase_id: selectedPhase,
          saison_id: selectedSeason?.id || null,
          limit: 100,
        },
      });

      if (error) throw error;
      
      return data?.items?.map((item: any) => ({
        coureur_id: item.rider_id,
        coureur_nom: item.rider_nom,
        coureur_equipe: item.rider_equipe,
        total_points: item.total_points,
        courses_count: item.courses_count,
        prix_achat: item.prix_achat,
        ratio_points_par_prix: item.ratio_points_par_prix,
        owners: item.owners,
        owners_all: item.owners_all,
      })) || [];
    },
  });

  // Filter riders by search term and manager ownership
  const filteredTopRiders = useMemo(() => {
    let filtered = allTopRiders || [];
    
    if (riderSearchTerm) {
      const searchNormalized = normalizeString(riderSearchTerm);
      filtered = filtered.filter(rider => 
        normalizeString(rider.coureur_nom).includes(searchNormalized) ||
        normalizeString(rider.coureur_equipe || '').includes(searchNormalized)
      );
    }
    
    if (hideRidersWithoutManagers) {
      filtered = filtered.filter(rider => {
        const owners = selectedPhase ? rider.owners : rider.owners_all;
        return owners && owners.length > 0;
      });
    }
    
    return filtered;
  }, [allTopRiders, riderSearchTerm, hideRidersWithoutManagers, selectedPhase]);

  const topRiders = filteredTopRiders?.slice(0, ridersDisplayLimit);

  const phaseChips = [
    { label: "Global", value: "null" },
    ...(phases?.map(p => ({
      label: `Phase ${p.index_dans_saison}`,
      value: p.id,
    })) || []),
  ];

  const tabChips = [
    { label: "🏆 Managers", value: "standings" as TabView },
    { label: "🚴 Top coureurs", value: "riders" as TabView },
    { label: "📈 Chrono", value: "timeline" as TabView },
    { label: "⚖️ Comparaison", value: "comparison" as TabView },
    { label: "👥 Équipes", value: "teams" as TabView },
    { label: "🏁 Courses", value: "courses" as TabView },
  ];

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const handleManagerClick = (managerId: string) => {
    setSelectedManager(managerId);
    setDetailsOpen(true);
  };

  const handleRiderClick = (rider: any) => {
    setSelectedRider({
      id: rider.coureur_id,
      nom: rider.coureur_nom,
      equipe: rider.coureur_equipe || '',
      prix: rider.prix_achat || 0,
    });
    setRiderDetailsOpen(true);
  };

  const ManagerNameWithSponsor = ({ managerId, managerName }: { managerId: string; managerName: string }) => {
    const { data: sponsorData } = useManagerSponsor(managerId, selectedSeason?.id);
    return (
      <div className="flex flex-col">
        <span className="font-semibold">{managerName}</span>
        {sponsorData?.sponsor && (
          <span className="text-xs text-muted-foreground italic">
            {sponsorData.sponsor}
          </span>
        )}
      </div>
    );
  };

  const RankBadge = ({ rank }: { rank: number }) => {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
    
    if (medal) {
      return <div className="text-3xl">{medal}</div>;
    }
    
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
        <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
      </div>
    );
  };

  const PointsBadge = ({ points, rank }: { points: number; rank: number }) => {
    const isPodium = rank <= 3;
    return (
      <div className="flex flex-col items-end">
        <div className="flex items-baseline gap-1">
          <span className={`font-bold ${isPodium ? 'text-3xl text-primary' : 'text-2xl'}`}>
            {points}
          </span>
          <span className="text-xs text-muted-foreground">pts</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 pb-0">
        <div className="mb-4">
          <Label htmlFor="phase-select" className="text-xs text-muted-foreground mb-2 block">
            Période
          </Label>
          <Select 
            value={selectedPhase || "null"} 
            onValueChange={(value) => setSelectedPhase(value === "null" ? null : value)}
          >
            <SelectTrigger id="phase-select" className="w-full">
              <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
              {phaseChips.map((chip) => (
                <SelectItem key={chip.value} value={chip.value}>
                  {chip.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/95 to-transparent z-10 pointer-events-none" />
          <div className="py-2 px-4">
            <ChipGroup
              items={tabChips}
              selected={activeTab}
              onSelect={(value) => setActiveTab(value as TabView)}
            />
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/95 to-transparent z-10 pointer-events-none" />
        </div>
      </div>

      <div className="p-4 pt-4">
        {activeTab === "standings" && (
          <div className="space-y-3 pb-4">
            {standingsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))
            ) : standings && standings.length > 0 ? (
              standings.map((standing, idx) => {
                const rank = idx + 1;
                const totalPoints = standings.reduce((sum, s) => sum + s.total_points, 0) || 1;
                const percentage = ((standing.total_points / totalPoints) * 100).toFixed(1);
                
                let evolution: number | null = null;
                let isNew = false;
                
                if (previousStandings) {
                  const previousRank = previousStandings.get(standing.manager_id);
                  if (previousRank) {
                    evolution = previousRank - rank;
                  } else {
                    isNew = true;
                  }
                }

                const evolutionBadge = isNew ? (
                  <Badge variant="outline" className="text-xs">NEW</Badge>
                ) : evolution !== null && evolution !== 0 ? (
                  <div className={`flex items-center gap-1 text-xs font-semibold ${
                    evolution > 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {evolution > 0 ? (
                      <>
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>+{evolution}</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-3.5 w-3.5 rotate-180" />
                        <span>{Math.abs(evolution)}</span>
                      </>
                    )}
                  </div>
                ) : null;

                const getRankLabel = (r: number) => {
                  if (r === 1) return "1er";
                  if (r === 2) return "2e";
                  if (r === 3) return "3e";
                  return `${r}e`;
                };

                return (
                  <MobileCard
                    key={standing.manager_id}
                    title={
                      <div className="flex items-center gap-2">
                        <ManagerNameWithSponsor managerId={standing.manager_id} managerName={standing.manager_nom} />
                        <ManagerPrestigeIcons 
                          managerId={standing.manager_id}
                          phaseId={selectedPhase}
                          saisonId={selectedSeason?.id}
                        />
                        {rank === 10 && <span className="text-lg">🤡</span>}
                      </div>
                    }
                    subtitle={`${percentage}% • ${getRankLabel(rank)}`}
                    meta={evolutionBadge}
                    avatar={<RankBadge rank={rank} />}
                    badge={<PointsBadge points={standing.total_points} rank={rank} />}
                    onClick={() => handleManagerClick(standing.manager_id)}
                  />
                );
              })
            ) : (
              <MobileEmptyState
                icon={<Trophy className="h-12 w-12" />}
                title="Aucun classement"
                description="Les classements apparaîtront ici une fois les courses terminées"
              />
            )}
          </div>
        )}

        {activeTab === "riders" && (
          <div className="space-y-3 pb-4">
            <div className="space-y-3 mb-4">
              <Input
                placeholder="Rechercher un coureur ou une équipe..."
                value={riderSearchTerm}
                onChange={(e) => setRiderSearchTerm(e.target.value)}
                className="h-10"
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-no-managers-mobile"
                  checked={hideRidersWithoutManagers}
                  onCheckedChange={setHideRidersWithoutManagers}
                />
                <Label htmlFor="hide-no-managers-mobile" className="text-sm cursor-pointer">
                  Masquer les coureurs sans manager
                </Label>
              </div>
            </div>

            {ridersLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))
            ) : !allTopRiders || allTopRiders.length === 0 ? (
              <MobileEmptyState
                icon={<User className="h-12 w-12" />}
                title="Aucun coureur"
                description="Les meilleurs coureurs apparaîtront ici"
              />
            ) : !topRiders || topRiders.length === 0 ? (
              <MobileEmptyState
                icon={<User className="h-12 w-12" />}
                title="Aucun résultat"
                description="Aucun coureur ne correspond à votre recherche"
              />
            ) : (
              <>
                {topRiders.map((rider, idx) => (
                  <MobileCard
                    key={rider.coureur_id}
                    title={rider.coureur_nom}
                    subtitle={rider.coureur_equipe || "Équipe inconnue"}
                    meta={`${rider.courses_count || 0} courses`}
                    onClick={() => handleRiderClick(rider)}
                    avatar={
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10">
                          {rider.coureur_nom.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    }
                    badge={
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-bold text-primary">
                          {rider.total_points}
                        </span>
                        <span className="text-xs text-muted-foreground">pts</span>
                      </div>
                    }
                  />
                ))}
                {filteredTopRiders && filteredTopRiders.length > ridersDisplayLimit && (
                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setRidersDisplayLimit(prev => Math.min(prev + 20, filteredTopRiders!.length))}
                      className="w-full"
                    >
                      Charger 20 de plus ({filteredTopRiders!.length - ridersDisplayLimit} restants)
                    </Button>
                    {ridersDisplayLimit >= 40 && (
                      <Button
                        variant="ghost"
                        onClick={() => setRidersDisplayLimit(filteredTopRiders!.length)}
                        className="w-full"
                      >
                        Voir tous ({filteredTopRiders!.length})
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="pb-4">
            <RecentPointsChart />
          </div>
        )}

        {activeTab === "comparison" && (
          <ManagerComparisonMobile phaseId={selectedPhase} saisonId={selectedSeason?.id || null} />
        )}

        {activeTab === "teams" && (
          <MobileEmptyState
            icon={<User className="h-12 w-12" />}
            title="Détail par équipe"
            description="Les détails par équipe seront disponibles prochainement"
          />
        )}

        {activeTab === "courses" && (
          <MobileEmptyState
            icon={<Trophy className="h-12 w-12" />}
            title="Par course"
            description="Les classements par course seront disponibles prochainement"
          />
        )}
      </div>

      <MobileBottomSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title="Détails Manager"
        description="Historique des points par course"
      >
        {selectedManager && (
          <ManagerBreakdown managerId={selectedManager} />
        )}
      </MobileBottomSheet>

      <RiderPointsDetail
        isOpen={riderDetailsOpen}
        onClose={() => {
          setRiderDetailsOpen(false);
          setSelectedRider(null);
        }}
        riderId={selectedRider?.id || ''}
        riderName={selectedRider?.nom || ''}
        riderTeam={selectedRider?.equipe || ''}
        riderPrice={selectedRider?.prix || 0}
        phaseId={selectedPhase || ''}
      />
    </div>
  );
};

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
import { useLeague } from "@/contexts/LeagueContext";
import { useNavigate } from "react-router-dom";

type TabView = "standings" | "riders" | "timeline" | "comparison";

export const RankingsMobile = () => {
  const { selectedSeason, phases, activePhase } = useSeasonContext();
  const { leagueId } = useLeague();
  const navigate = useNavigate();
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
  const [expandedManagerId, setExpandedManagerId] = useState<string | null>(null);

  // Fetch standings
  const { data: standings, isLoading: standingsLoading } = useQuery({
    queryKey: ["manager-standings-mobile", selectedPhase, selectedSeason?.id, leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      
      if (selectedPhase) {
        const { data, error } = await supabase
          .from("v_manager_standings_by_phase_v2")
          .select("*")
          .eq("phase_id", selectedPhase)
          .eq("league_id", leagueId)
          .order("total_points", { ascending: false });
        
        if (error) throw error;
        return data || [];
      } else if (selectedSeason) {
        const { data, error } = await supabase
          .from("v_manager_standings_by_season_v2")
          .select("*")
          .eq("saison_id", selectedSeason.id)
          .eq("league_id", leagueId)
          .order("total_points", { ascending: false });
        
        if (error) throw error;
        return data || [];
      } else {
        const { data, error } = await supabase
          .from("v_manager_standings_total")
          .select("*")
          .eq("league_id", leagueId)
          .order("total_points", { ascending: false });
        
        if (error) throw error;
        
        // Enrich with manager names
        const managerIds = [...new Set(data?.map(d => d.manager_id) || [])];
        const { data: managersData } = await supabase
          .from("managers")
          .select("id, nom")
          .in("id", managerIds);
        
        const managersMap = new Map(managersData?.map(m => [m.id, m.nom]) || []);
        
        return data?.map(d => ({
          ...d,
          manager_nom: managersMap.get(d.manager_id) || 'Unknown'
        })) || [];
      }
    },
  });

  // Fetch previous global standings for evolution calculation (global view only)
  const { data: previousGlobalStandings } = useQuery({
    queryKey: ["previous-global-standings-mobile", selectedSeason?.id, activePhase?.id],
    queryFn: async () => {
      if (selectedPhase || !activePhase) return null;

      const { data, error } = await supabase.rpc('get_previous_standings', {
        p_saison_id: selectedSeason?.id || null,
        p_reference_phase_id: activePhase.id,
        p_league_id: leagueId
      });

      if (error) {
        console.error('Error fetching previous standings:', error);
        return null;
      }

      // Convert to Map<manager_id, rank>
      const rankMap = new Map<string, number>();
      data?.forEach((row: any) => {
        rankMap.set(row.manager_id, row.rank);
      });
      return rankMap;
    },
    enabled: !selectedPhase && !!activePhase,
  });

  // Fetch top riders using edge function
  const { data: allTopRiders, isLoading: ridersLoading } = useQuery({
    queryKey: ["top-riders-mobile", selectedPhase, selectedSeason?.id, leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      
      const { data, error } = await supabase.functions.invoke('get-top-riders', {
        body: {
          phase_id: selectedPhase,
          saison_id: selectedSeason?.id || null,
          league_id: leagueId,
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
    { label: "Managers", value: "standings" as TabView },
    { label: "Coureurs", value: "riders" as TabView },
    { label: "Chrono", value: "timeline" as TabView },
    { label: "Comparaison", value: "comparison" as TabView },
  ];

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const handleManagerClick = (managerId: string) => {
    setExpandedManagerId(expandedManagerId === managerId ? null : managerId);
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
    if (rank === 1) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#FFD500] border-2 border-black">
          <span className="text-sm font-bold text-black">1er</span>
        </div>
      );
    }
    
    if (rank === 2) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-black border-2 border-[#FFD500]">
          <span className="text-sm font-bold text-[#FFD500]">2e</span>
        </div>
      );
    }
    
    if (rank === 3) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-[#FFD500]">
          <span className="text-sm font-bold text-black">3e</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
        <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
      </div>
    );
  };

  const PointsBadge = ({ points }: { points: number }) => {
    return (
      <div className="flex flex-col items-end">
        <span className="text-lg font-bold">{points}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 pb-0">
        <Select 
          value={selectedPhase || "null"} 
          onValueChange={(value) => setSelectedPhase(value === "null" ? null : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Global" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">Global</SelectItem>
            {phases?.map((phase) => (
              <SelectItem key={phase.id} value={phase.id}>
                Phase {phase.index_dans_saison}{phase.statut === 'active' ? ' ✓' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                
                // Calculate evolution - ONLY for global view
                let evolution: number | null = null;
                let isNew = false;
                
                if (!selectedPhase && previousGlobalStandings) {
                  const previousRank = previousGlobalStandings.get(standing.manager_id);
                  if (previousRank) {
                    evolution = previousRank - rank; // Positive = gained places
                  } else {
                    isNew = true;
                  }
                }

                // Only show evolution badge in global view
                const evolutionBadge = !selectedPhase && previousGlobalStandings ? (
                  isNew ? (
                    <Badge className="bg-[#FFD500] text-black border-2 border-black text-xs font-bold">NEW</Badge>
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
                  ) : null
                ) : null;

                const getRankLabel = (r: number) => {
                  if (r === 1) return "1er";
                  if (r === 2) return "2e";
                  if (r === 3) return "3e";
                  return `${r}e`;
                };

                const isExpanded = expandedManagerId === standing.manager_id;

                return (
                  <MobileCard
                    key={standing.manager_id}
                    title={<ManagerNameWithSponsor managerId={standing.manager_id} managerName={standing.manager_nom} />}
                    avatar={<RankBadge rank={rank} />}
                    badge={<PointsBadge points={standing.total_points} />}
                    onClick={() => handleManagerClick(standing.manager_id)}
                    expanded={isExpanded}
                    expandedContent={
                      <div className="space-y-3">
                        {/* Prestige icons + 🤡 emoji */}
                        <div className="flex items-center gap-2">
                          <ManagerPrestigeIcons 
                            managerId={standing.manager_id} 
                            phaseId={selectedPhase}
                            saisonId={selectedSeason?.id}
                            isMobile
                          />
                          {rank === 10 && <span className="text-lg">🤡</span>}
                        </div>

                        {/* Evolution badge */}
                        {evolutionBadge && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">Évolution:</span>
                            {evolutionBadge}
                          </div>
                        )}

                        {/* Statistics grid */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Position</span>
                            <span className="font-semibold">{getRankLabel(rank)}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground">% du total</span>
                            <span className="font-semibold">{percentage}%</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Scoreurs</span>
                            <span className="font-semibold">{standing.scoreurs_count ?? 0}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Victoires</span>
                            <span className="font-semibold">{standing.victories_count ?? 0}</span>
                          </div>
                        </div>

                        {/* Full detail button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/rankings/${standing.manager_id}`);
                          }}
                        >
                          Voir le détail complet
                        </Button>
                      </div>
                    }
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
                {topRiders.map((rider, idx) => {
                  const rank = idx + 1;
                  
                  return (
                    <MobileCard
                      key={rider.coureur_id}
                      title={rider.coureur_nom}
                      subtitle={rider.coureur_equipe || "Équipe inconnue"}
                      meta={`${rider.courses_count || 0} courses`}
                      onClick={() => handleRiderClick(rider)}
                      avatar={
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                          <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
                        </div>
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
                  );
                })}
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
            <RecentPointsChart 
              phaseId={selectedPhase} 
              saisonId={selectedSeason?.id || null}
              viewMode={selectedPhase ? 'phase' : 'season'}
            />
          </div>
        )}

        {activeTab === "comparison" && (
          <ManagerComparisonMobile phaseId={selectedPhase} saisonId={selectedSeason?.id || null} />
        )}
      </div>

      <MobileBottomSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title="Détails Manager"
        description="Historique des points par course"
      >
        {selectedManager && (
          <ManagerBreakdown managerId={selectedManager} phaseId={selectedPhase} />
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
        saisonId={selectedSeason?.id}
      />

    </div>
  );
};

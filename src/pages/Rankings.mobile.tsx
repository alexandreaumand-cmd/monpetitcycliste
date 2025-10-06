import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChipGroup } from "@/components/mobile/ChipGroup";
import { MobileCard } from "@/components/mobile/MobileCard";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { MobileEmptyState } from "@/components/mobile/MobileEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, User, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type TabView = "standings" | "riders" | "timeline" | "teams" | "courses";

export const RankingsMobile = () => {
  const [activeTab, setActiveTab] = useState<TabView>("standings");
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch phases
  const { data: phases } = useQuery({
    queryKey: ["phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phases")
        .select("*")
        .order("index_dans_saison", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

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
        // For global view, get previous global standings
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
        // For phase view, get previous phase standings
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

  // Fetch top riders
  const { data: topRiders, isLoading: ridersLoading } = useQuery({
    queryKey: ["top-riders-mobile", selectedPhase],
    queryFn: async () => {
      if (selectedPhase) {
        const { data, error } = await supabase
          .from("v_top_riders_by_phase")
          .select("*")
          .eq("phase_id", selectedPhase)
          .order("total_points", { ascending: false })
          .limit(20);
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("v_top_riders_global")
          .select("*")
          .order("total_points", { ascending: false })
          .limit(20);
        
        if (error) throw error;
        return data;
      }
    },
  });

  const phaseChips = [
    { label: "Global", value: "null" },
    ...(phases?.map(p => ({
      label: `Phase ${p.index_dans_saison}`,
      value: p.id,
    })) || []),
  ];

  const tabChips = [
    { label: "🏆 Général", value: "standings" as TabView },
    { label: "🚴 Top 20", value: "riders" as TabView },
    { label: "📈 Chrono", value: "timeline" as TabView },
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

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 pb-0">
        {/* Phase Filter - Select */}
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

      {/* Sticky Tabs with Scroll Indicator */}
      <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="relative">
          {/* Gradient fade-out gauche */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/95 to-transparent z-10 pointer-events-none" />
          
          {/* Tabs scrollables */}
          <div className="py-2 px-4">
            <ChipGroup
              items={tabChips}
              selected={activeTab}
              onSelect={(value) => setActiveTab(value as TabView)}
            />
          </div>
          
          {/* Gradient fade-out droite */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/95 to-transparent z-10 pointer-events-none" />
        </div>
      </div>

      {/* Content */}
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
                
                // Calculate evolution
                let evolution: number | null = null;
                let isNew = false;
                
                if (previousStandings) {
                  const previousRank = previousStandings.get(standing.manager_id);
                  if (previousRank) {
                    evolution = previousRank - rank; // Positive = gained places
                  } else {
                    isNew = true;
                  }
                }

                return (
                  <MobileCard
                    key={standing.manager_id}
                    title={standing.manager_nom}
                    subtitle={`${standing.total_points} pts • ${percentage}%`}
                    meta={
                      isNew ? (
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
                      ) : undefined
                    }
                    avatar={
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                        {getRankBadge(rank)}
                      </div>
                    }
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
            {ridersLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))
            ) : topRiders && topRiders.length > 0 ? (
              topRiders.map((rider, idx) => (
                <MobileCard
                  key={rider.coureur_id}
                  title={rider.coureur_nom}
                  subtitle={rider.coureur_equipe || "Équipe inconnue"}
                  meta={`${rider.courses_count || 0} courses`}
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
              ))
            ) : (
              <MobileEmptyState
                icon={<User className="h-12 w-12" />}
                title="Aucun coureur"
                description="Les meilleurs coureurs apparaîtront ici"
              />
            )}
          </div>
        )}

        {activeTab === "timeline" && (
          <MobileEmptyState
            icon={<TrendingUp className="h-12 w-12" />}
            title="Chronologie"
            description="Le graphique de chronologie sera disponible prochainement"
          />
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

      {/* Manager Details Bottom Sheet */}
      <MobileBottomSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title="Détails Manager"
        description="Historique des points par course"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Les détails du manager seront affichés ici
          </p>
        </div>
      </MobileBottomSheet>
    </div>
  );
};

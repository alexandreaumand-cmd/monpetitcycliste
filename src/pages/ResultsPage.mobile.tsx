import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trophy, Calendar, Search, Shirt } from "lucide-react";
import { useDebounce } from "use-debounce";
import { CourseResultsDrawer } from "@/components/courses/CourseResultsDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileCard, MobileEmptyState } from "@/components/mobile";
import { AdminMaintenance } from "@/components/admin/AdminMaintenance";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerJerseys } from "@/hooks/useManagerJerseys";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLeague } from "@/contexts/LeagueContext";

interface Race {
  course_id: string;
  nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  last_result_at: string;
  types: string[];
}

interface ManagerPodium {
  manager_id: string;
  manager_nom: string;
  points: number;
  rank: number;
}

interface RaceWinner {
  coureur_nom: string;
}

interface Phase {
  id: string;
  index_dans_saison: number;
  date_debut: string;
  date_fin: string;
  statut: 'draft' | 'active' | 'completed' | 'auction_open' | 'auction_closed';
}

export const ResultsPageMobile = () => {
  const { selectedSeason, phases, activePhase, isLoading: isLoadingContext } = useSeasonContext();
  const { leagueId } = useLeague();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>("global");
  const [podiums, setPodiums] = useState<Record<string, ManagerPodium[]>>({});
  const [winners, setWinners] = useState<Record<string, RaceWinner>>({});
  
  const allPodiumManagerIds = Object.values(podiums)
    .flatMap(p => p.slice(0, 3).map(m => m.manager_id))
    .filter(Boolean) as string[];
  const { data: jerseys = {} } = useManagerJerseys(allPodiumManagerIds, selectedSeason?.id);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingContext) {
      loadRaces(true);
    }
  }, [selectedPhaseId, debouncedSearch, isLoadingContext, leagueId]);


  const loadRaces = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setRaces([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = reset ? 0 : races.length;
      
      const { data, error } = await supabase.functions.invoke('results-courses-with-entries', {
        body: { 
          search: debouncedSearch || null,
          limit: 24,
          offset: currentOffset,
          phase_id: selectedPhaseId === "global" ? null : selectedPhaseId,
          saison_id: selectedSeason?.id
        }
      });

      if (error) throw error;
      
      const loadedRaces = data.races || [];
      
      if (reset) {
        setRaces(loadedRaces);
      } else {
        setRaces(prev => [...prev, ...loadedRaces]);
      }
      
      setHasMore(data.has_more || false);

      if (loadedRaces.length > 0) {
        const courseIds = loadedRaces.map((r: Race) => r.course_id);
      const { data: podiumsData } = await supabase.functions.invoke('results-courses-podiums', {
        body: { 
          course_ids: courseIds,
          saison_id: selectedSeason?.id,
          league_id: leagueId
        }
      });
        
        if (podiumsData) {
          setPodiums(prev => reset ? (podiumsData.podiums || {}) : { ...prev, ...(podiumsData.podiums || {}) });
          setWinners(prev => reset ? (podiumsData.winners || {}) : { ...prev, ...(podiumsData.winners || {}) });
        }
      }
    } catch (error) {
      console.error('Error loading races:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const openRaceDrawer = (race: Race) => {
    setSelectedCourseId(race.course_id);
    setDrawerOpen(true);
  };

  const getPhaseLabel = (phase: any) => {
    const debut = new Date(phase.date_debut).toLocaleDateString('fr-FR', { month: 'short' });
    const fin = new Date(phase.date_fin).toLocaleDateString('fr-FR', { month: 'short' });
    
    const today = new Date();
    const isActive = today >= new Date(phase.date_debut) && today <= new Date(phase.date_fin);
    
    return `Phase ${phase.index_dans_saison} (${debut} - ${fin})${isActive ? ' ✓' : ''}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Admin Maintenance Component */}
      <div className="p-4">
        <AdminMaintenance />
      </div>
      
      {/* Header */}
      <div className="sticky top-14 z-10 bg-background border-b safe-top">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Résultats</h1>
            </div>
          </div>

          <Select value={selectedPhaseId || 'global'} onValueChange={setSelectedPhaseId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                🌍 Global (toute la saison)
              </SelectItem>
              {phases.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  {getPhaseLabel(phase)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Liste des courses */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : races.length === 0 ? (
          <MobileEmptyState
            icon={<Trophy className="h-16 w-16" />}
            title="Aucune course trouvée"
            description={searchQuery ? "Aucune course pour cette recherche" : "Aucune course avec résultats"}
            action={
              searchQuery ? (
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Réinitialiser
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {races.map((race) => {
              const racePodium = podiums[race.course_id] || [];
              const raceWinner = winners[race.course_id];
              
              return (
                <MobileCard
                  key={race.course_id}
                  title={race.nom}
                  subtitle={
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(race.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' → '}
                        {new Date(race.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  }
                  badge={<Badge variant="secondary" className="text-xs">{race.categorie}</Badge>}
                  onClick={() => openRaceDrawer(race)}
                >
                  {raceWinner && (
                    <div className="flex items-center gap-1.5 text-xs mt-2 py-1.5 px-2 bg-muted/50 rounded-lg">
                      <Trophy className="h-3 w-3 text-yellow-500" />
                      <span className="font-medium">{raceWinner.coureur_nom}</span>
                    </div>
                  )}
                  
                  {racePodium.length > 0 && (
                    <div className="mt-2 pt-2 border-t space-y-1">
                      {racePodium.slice(0, 3).map((manager, idx) => (
                        <div key={manager.manager_nom} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            {jerseys[manager.manager_id] ? (
                              <img src={jerseys[manager.manager_id]} alt="Maillot" className="h-4 w-4 object-contain rounded" />
                            ) : (
                              <span className="text-sm">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                              </span>
                            )}
                            <span className="font-medium truncate">{manager.manager_nom}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {manager.points} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </MobileCard>
              );
            })}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => loadRaces(false)}
                  disabled={loadingMore}
                  variant="outline"
                  className="w-full"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    'Charger plus'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <CourseResultsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        courseId={selectedCourseId}
      />
    </div>
  );
};

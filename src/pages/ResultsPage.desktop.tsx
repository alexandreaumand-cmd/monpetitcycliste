import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trophy, Calendar, Search, Shirt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "use-debounce";
import { CourseResultsDrawer } from "@/components/courses/CourseResultsDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerJerseys } from "@/hooks/useManagerJerseys";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";

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

export const ResultsPage = () => {
  const { selectedSeason, phases, activePhase, isLoading: isLoadingContext } = useSeasonContext();
  const { leagueId } = useLeague();
  const { leagues } = useUserLeagues();
  const currentLeague = leagues.find((l) => l.id === leagueId);
  const isPerCourse = currentLeague?.game_mode === 'per_course';
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
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  
  // URL params for deep linking from notifications
  const [searchParams, setSearchParams] = useSearchParams();
  const courseIdFromUrl = searchParams.get('courseId');

  // Open drawer automatically if courseId is in URL
  useEffect(() => {
    if (courseIdFromUrl) {
      setSelectedCourseId(courseIdFromUrl);
      setDrawerOpen(true);
      // Clean up URL after opening
      searchParams.delete('courseId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [courseIdFromUrl]);

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
          saison_id: selectedSeason?.id,
          league_id: leagueId
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

      // Load podiums and winners - single call (results-courses-podiums returns both)
      if (loadedRaces.length > 0) {
        const courseIds = loadedRaces.map((r: Race) => r.course_id);
        
        try {
          const { data, error } = await supabase.functions.invoke('results-courses-podiums', {
            body: { 
              course_ids: courseIds,
              saison_id: selectedSeason?.id,
              league_id: leagueId
            }
          });
          
          if (error) {
            console.error('Error loading podiums/winners:', error);
          } else if (data) {
            setWinners(prev => reset ? (data.winners || {}) : { ...prev, ...(data.winners || {}) });
            setPodiums(prev => reset ? (data.podiums || {}) : { ...prev, ...(data.podiums || {}) });
            console.log(`Loaded podiums for ${Object.keys(data.podiums || {}).length} courses`);
          }
        } catch (error) {
          console.error('Failed to load podiums/winners:', error);
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
    <div className="space-y-4">
      
      {/* Header with search */}
      <div className="sticky top-0 z-10 bg-background pb-3 border-b">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-3">
          <div>
            <h1 className="text-3xl font-bold">Résultats</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:inline">Phase:</span>
            <Select value={selectedPhaseId || 'global'} onValueChange={setSelectedPhaseId}>
              <SelectTrigger className="w-full md:w-[250px]">
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
            
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grille des courses */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : races.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Aucune course trouvée</h3>
          <p className="text-muted-foreground mb-4">
            Aucune course avec résultats{searchQuery ? " pour cette recherche" : ""}
          </p>
          {searchQuery && (
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Réinitialiser la recherche
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {races.map((race) => (
              <Card 
                key={race.course_id}
                className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                onClick={() => openRaceDrawer(race)}
              >
                <CardHeader>
                  <CardTitle className="text-base line-clamp-2">{race.nom}</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(race.date_debut).toLocaleDateString('fr-FR')} 
                    {' → '}
                    {new Date(race.date_fin).toLocaleDateString('fr-FR')}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{race.categorie}</Badge>
                    {winners[race.course_id] && (
                      <div className="flex items-center gap-1 text-xs">
                        <span>🏆</span>
                        <span className="font-medium">{winners[race.course_id].coureur_nom}</span>
                      </div>
                    )}
                  </div>
                  
                  {podiums[race.course_id] && podiums[race.course_id].length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t">
                      {podiums[race.course_id].slice(0, 3).map((manager, idx) => (
                        <div key={manager.manager_nom} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            {jerseys[manager.manager_id] ? (
                              <img src={jerseys[manager.manager_id]} alt="Maillot" className="h-4 w-4 object-contain rounded" />
                            ) : (
                              <span className="text-base">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                            )}
                            <span className="font-medium truncate">{manager.manager_nom}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {Math.round(manager.points)} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {winners[race.course_id] && (!podiums[race.course_id] || podiums[race.course_id].length === 0) && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Aucun manager n'a marqué sur cette course (pour votre ligue)
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => loadRaces(false)}
                disabled={loadingMore}
                variant="outline"
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

      {/* Drawer détail */}
      <CourseResultsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        courseId={selectedCourseId}
      />
    </div>
  );
};

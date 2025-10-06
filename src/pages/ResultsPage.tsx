import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trophy, Calendar, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "use-debounce";
import { CourseResultsDrawer } from "@/components/courses/CourseResultsDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  manager_nom: string;
  points: number;
  rank: number;
}

interface Phase {
  id: string;
  index_dans_saison: number;
  date_debut: string;
  date_fin: string;
  statut: 'draft' | 'active' | 'completed' | 'auction_open' | 'auction_closed';
}

export const ResultsPage = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [podiums, setPodiums] = useState<Record<string, ManagerPodium[]>>({});
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    loadPhases();
  }, []);

  useEffect(() => {
    if (selectedPhaseId) {
      loadRaces(true);
    }
  }, [selectedPhaseId, debouncedSearch]);

  const loadPhases = async () => {
    const { data: saisonData } = await supabase
      .from('saisons')
      .select('id')
      .eq('annee', 2025)
      .single();

    if (!saisonData) return;

    const { data: phasesData } = await supabase
      .from('phases')
      .select('id, index_dans_saison, date_debut, date_fin, statut')
      .eq('saison_id', saisonData.id)
      .order('index_dans_saison', { ascending: true });

    setPhases(phasesData || []);

    // Sélectionner la phase actuelle basée sur la date
    const today = new Date();
    const currentPhase = phasesData?.find(p => {
      const debut = new Date(p.date_debut);
      const fin = new Date(p.date_fin);
      return today >= debut && today <= fin;
    });

    if (currentPhase) {
      setSelectedPhaseId(currentPhase.id);
    } else if (phasesData && phasesData.length > 0) {
      setSelectedPhaseId(phasesData[phasesData.length - 1].id);
    }
  };

  const loadRaces = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
      setRaces([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke('results-courses-with-entries', {
        body: { 
          search: debouncedSearch || null,
          limit: 24,
          offset: reset ? 0 : offset,
          phase_id: selectedPhaseId
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
      if (!reset) {
        setOffset(prev => prev + 24);
      }

      // Load podiums for the courses
      if (loadedRaces.length > 0) {
        const courseIds = loadedRaces.map((r: Race) => r.course_id);
        const { data: podiumsData } = await supabase.functions.invoke('results-courses-podiums', {
          body: { course_ids: courseIds }
        });
        
        if (podiumsData) {
          setPodiums(prev => reset ? podiumsData : { ...prev, ...podiumsData });
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

  const getPhaseLabel = (phase: Phase) => {
    const debut = new Date(phase.date_debut).toLocaleDateString('fr-FR', { month: 'short' });
    const fin = new Date(phase.date_fin).toLocaleDateString('fr-FR', { month: 'short' });
    
    const today = new Date();
    const isActive = today >= new Date(phase.date_debut) && today <= new Date(phase.date_fin);
    
    return `Phase ${phase.index_dans_saison} (${debut} - ${fin})${isActive ? ' ✓' : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Header with search */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold">Résultats</h1>
            <p className="text-muted-foreground">
              {races.length} course{races.length > 1 ? 's' : ''} avec résultats
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:inline">Phase:</span>
            <Select value={selectedPhaseId || ''} onValueChange={setSelectedPhaseId}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Toutes les phases" />
              </SelectTrigger>
              <SelectContent>
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
                  <Badge variant="secondary">{race.categorie}</Badge>
                  
                  {podiums[race.course_id] && podiums[race.course_id].length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        🏆 Podium managers
                      </div>
                      {podiums[race.course_id].slice(0, 3).map((manager, idx) => (
                        <div key={manager.manager_nom} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                            </span>
                            <span className="font-medium truncate">{manager.manager_nom}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {manager.points} pts
                          </Badge>
                        </div>
                      ))}
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

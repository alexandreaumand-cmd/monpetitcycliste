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

interface Race {
  course_id: string;
  nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  last_result_at: string;
  types: string[];
}

export const ResultsPage = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    loadRaces(true);
  }, [debouncedSearch]);

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
          offset: reset ? 0 : offset
        }
      });

      if (error) throw error;
      
      if (reset) {
        setRaces(data.races || []);
      } else {
        setRaces(prev => [...prev, ...(data.races || [])]);
      }
      
      setHasMore(data.has_more || false);
      if (!reset) {
        setOffset(prev => prev + 24);
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

  return (
    <div className="space-y-6">
      {/* Header with search */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold">Résultats</h1>
            <p className="text-muted-foreground">
              {races.length} course{races.length > 1 ? 's' : ''} avec résultats
            </p>
          </div>
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
                  
                  <div className="flex flex-wrap gap-1">
                    {race.types.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
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

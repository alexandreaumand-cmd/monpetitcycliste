import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Trophy, Calendar, Search, Medal, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useDebounce } from "use-debounce";

interface Race {
  course_id: string;
  nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  last_result_at: string;
  types: string[];
}

interface RaceMeta {
  course_nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  types_disponibles: string[];
  etapes_disponibles: number[];
}

interface RaceRow {
  row_position: number | null;
  statut: string;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  manager_nom: string | null;
  points_officiels: number | null;
  points_theoriques: number;
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
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [raceMeta, setRaceMeta] = useState<RaceMeta | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const [results, setResults] = useState<RaceRow[]>([]);
  const [filteredResults, setFilteredResults] = useState<RaceRow[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState("");

  useEffect(() => {
    loadRaces(true);
  }, [debouncedSearch]);

  useEffect(() => {
    if (selectedRace && selectedType) {
      loadRaceResults();
    }
  }, [selectedRace, selectedType, selectedEtape]);

  useEffect(() => {
    // Filter results by drawer search
    if (drawerSearch) {
      const query = drawerSearch.toLowerCase();
      setFilteredResults(results.filter(r => 
        r.coureur_nom.toLowerCase().includes(query)
      ));
    } else {
      setFilteredResults(results);
    }
  }, [results, drawerSearch]);

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

  const openRaceDrawer = async (race: Race) => {
    setSelectedRace(race);
    setDrawerOpen(true);
    setLoadingResults(true);
    setDrawerSearch("");

    try {
      const { data, error } = await supabase.functions.invoke('results-course-meta', {
        body: { course_id: race.course_id }
      });

      if (error) throw error;
      
      const meta = data.meta;
      setRaceMeta(meta);
      
      // Set default type (General preferred, or first available)
      const defaultType = meta?.types_disponibles?.includes("General") 
        ? "General" 
        : meta?.types_disponibles?.[0] || "";
      
      setSelectedType(defaultType);
      
      // If Etape, select last stage
      if (defaultType === "Etape" && meta?.etapes_disponibles?.length > 0) {
        setSelectedEtape(meta.etapes_disponibles[meta.etapes_disponibles.length - 1]);
      } else {
        setSelectedEtape(null);
      }
    } catch (error) {
      console.error('Error loading race meta:', error);
      setLoadingResults(false);
    }
  };

  const loadRaceResults = async () => {
    if (!selectedRace || !selectedType) return;

    setLoadingResults(true);
    try {
      const { data, error } = await supabase.functions.invoke('results-course-rows', {
        body: {
          course_id: selectedRace.course_id,
          type_classement: selectedType,
          etape_numero: selectedEtape
        }
      });

      if (error) throw error;
      setResults(data.rows || []);
    } catch (error) {
      console.error('Error loading race results:', error);
    } finally {
      setLoadingResults(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getStatutBadge = (statut: string) => {
    const config: Record<string, { variant: any; label: string }> = {
      finished: { variant: 'default', label: 'Terminé' },
      dnf: { variant: 'destructive', label: 'DNF' },
      dns: { variant: 'secondary', label: 'DNS' },
      dsq: { variant: 'destructive', label: 'DSQ' }
    };
    const { variant, label } = config[statut] || { variant: 'secondary', label: statut?.toUpperCase() || 'N/A' };
    return <Badge variant={variant}>{label}</Badge>;
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
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DrawerTitle className="text-2xl">{raceMeta?.course_nom || selectedRace?.nom}</DrawerTitle>
                <DrawerDescription>
                  {raceMeta && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">{raceMeta.categorie}</Badge>
                      <span className="text-sm flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(raceMeta.date_debut).toLocaleDateString('fr-FR')} 
                        {' - '}
                        {new Date(raceMeta.date_fin).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>

            {/* Type selector pills */}
            {raceMeta && (
              <div className="flex flex-wrap gap-2 mt-4">
                {raceMeta.types_disponibles?.map((type) => (
                  <Button
                    key={type}
                    variant={selectedType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedType(type);
                      if (type !== "Etape") setSelectedEtape(null);
                    }}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            )}

            {/* Etape selector if applicable */}
            {selectedType === "Etape" && raceMeta?.etapes_disponibles && raceMeta.etapes_disponibles.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <label className="text-sm font-medium">Étape:</label>
                <Select 
                  value={selectedEtape?.toString() || ""} 
                  onValueChange={(v) => setSelectedEtape(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {raceMeta.etapes_disponibles.map((etape) => (
                      <SelectItem key={etape} value={etape.toString()}>
                        Étape {etape}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Search riders */}
            {results.length > 0 && (
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un coureur..."
                  value={drawerSearch}
                  onChange={(e) => setDrawerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </DrawerHeader>

          <div className="overflow-y-auto p-6">
            {loadingResults ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Aucun résultat</h3>
                <p className="text-sm text-muted-foreground">
                  {drawerSearch ? "Aucun coureur trouvé pour cette recherche" : "Pas de classement disponible pour ce type"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResults.map((result, idx) => (
                  <Card key={`${result.coureur_id}-${idx}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-14 w-14 flex-shrink-0">
                          <AvatarFallback className="text-base font-bold">
                            {getInitials(result.coureur_nom)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Position or Status */}
                          <div>
                            {result.row_position ? (
                              <div className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full h-7 w-7 text-base font-bold">
                                {result.row_position}
                              </div>
                            ) : (
                              getStatutBadge(result.statut)
                            )}
                          </div>

                          {/* Rider name */}
                          <div className="font-bold text-base truncate">
                            {result.coureur_nom}
                          </div>

                          {/* Team */}
                          <Badge variant="secondary" className="text-xs">
                            {result.equipe || 'Équipe inconnue'}
                          </Badge>

                          {/* Manager */}
                          {result.manager_nom && (
                            <div className="text-xs text-muted-foreground truncate">
                              {result.manager_nom}
                            </div>
                          )}

                          {/* Points */}
                          <div className="flex items-center gap-2">
                            <Medal className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="font-bold text-lg">
                              {result.points_officiels !== null 
                                ? result.points_officiels 
                                : result.points_theoriques}
                            </span>
                            <Badge 
                              variant={result.points_officiels !== null ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {result.points_officiels !== null ? "Off." : "Barème"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

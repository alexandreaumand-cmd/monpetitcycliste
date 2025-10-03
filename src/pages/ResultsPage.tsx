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
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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

interface ResultRow {
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
  // Master view state
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
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [riderSearchQuery, setRiderSearchQuery] = useState("");

  useEffect(() => {
    loadRaces(true);
  }, [debouncedSearch]);

  useEffect(() => {
    if (selectedRace && selectedType) {
      loadRaceResults();
    }
  }, [selectedType, selectedEtape]);

  const loadRaces = async (reset: boolean = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = reset ? 0 : offset;
      const { data, error } = await supabase.functions.invoke('results-courses-with-entries', {
        body: { 
          search: debouncedSearch || null,
          limit: 24,
          offset: currentOffset
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
        setOffset(currentOffset + 24);
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

    try {
      const { data, error } = await supabase.functions.invoke('results-course-meta-v2', {
        body: { course_id: race.course_id }
      });

      if (error) throw error;
      setRaceMeta(data.meta);
      
      // Set default type (General preferred, or first available)
      const defaultType = data.meta?.types_disponibles?.includes("General") 
        ? "General" 
        : data.meta?.types_disponibles?.[0] || "";
      
      setSelectedType(defaultType);
      
      // If Etape, select last stage
      if (defaultType === "Etape" && data.meta?.etapes_disponibles?.length > 0) {
        setSelectedEtape(data.meta.etapes_disponibles[data.meta.etapes_disponibles.length - 1]);
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

  const filteredResults = riderSearchQuery
    ? results.filter(r => r.coureur_nom.toLowerCase().includes(riderSearchQuery.toLowerCase()))
    : results;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b">
        <div className="mb-4">
          <h1 className="text-3xl font-bold">Résultats</h1>
          <p className="text-muted-foreground">
            Courses avec résultats disponibles
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchQuery && (
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery("");
                setOffset(0);
              }}
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Grid of race cards */}
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
            {searchQuery 
              ? "Aucune course avec résultats ne correspond à votre recherche"
              : "Aucune course avec résultats disponible pour le moment"}
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
                <CardHeader className="pb-3">
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
            <div className="text-center pt-4">
              <Button 
                variant="outline" 
                onClick={() => loadRaces(false)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

      {/* Drawer for race details */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DrawerTitle className="text-2xl">{raceMeta?.course_nom || selectedRace?.nom}</DrawerTitle>
                <DrawerDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{raceMeta?.categorie || selectedRace?.categorie}</Badge>
                  <span>•</span>
                  <Calendar className="h-4 w-4" />
                  {raceMeta && (
                    <>
                      {new Date(raceMeta.date_debut).toLocaleDateString('fr-FR')} 
                      {' - '}
                      {new Date(raceMeta.date_fin).toLocaleDateString('fr-FR')}
                    </>
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
            <div className="flex flex-wrap gap-2 mt-4">
              {raceMeta?.types_disponibles?.map((type: string) => (
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

            {/* Etape selector + rider search */}
            <div className="flex gap-4 mt-4">
              {selectedType === "Etape" && raceMeta?.etapes_disponibles?.length > 0 && (
                <Select 
                  value={selectedEtape?.toString() || ""} 
                  onValueChange={(v) => setSelectedEtape(parseInt(v))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sélectionner étape" />
                  </SelectTrigger>
                  <SelectContent>
                    {raceMeta.etapes_disponibles.map((etape: number) => (
                      <SelectItem key={etape} value={etape.toString()}>
                        Étape {etape}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un coureur..."
                  value={riderSearchQuery}
                  onChange={(e) => setRiderSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </DrawerHeader>

          {/* Results grid */}
          <div className="p-6 overflow-y-auto">
            {loadingResults ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  {riderSearchQuery ? "Aucun coureur trouvé" : "Aucun classement disponible"}
                </h3>
                <p className="text-muted-foreground">
                  {riderSearchQuery 
                    ? "Essayez avec un autre nom" 
                    : "Pas de résultats pour ce type de classement"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResults.map((result, idx) => (
                  <Card key={`${result.coureur_id}-${idx}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <Avatar className="h-14 w-14 flex-shrink-0">
                          <AvatarFallback className="text-base font-bold">
                            {getInitials(result.coureur_nom)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Position or Status */}
                          <div>
                            {result.row_position ? (
                              <div className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full h-8 w-8 text-base font-bold">
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
                          <div className="text-xs text-muted-foreground truncate">
                            {result.manager_nom || '—'}
                          </div>

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
                              {result.points_officiels !== null ? "Officiel" : "Barème"}
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

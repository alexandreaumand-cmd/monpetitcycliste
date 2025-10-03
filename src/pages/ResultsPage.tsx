import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Trophy, Calendar, Search, Medal, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface Race {
  course_id: string;
  nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  types: string[];
  my_points: number;
  has_points: boolean;
}

interface RaceResult {
  race_result_id: string;
  row_position: number | null;
  statut: string;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  manager_id: string | null;
  manager_nom: string | null;
  points_theoriques: number;
  points_officiels: number | null;
  is_my_rider: boolean;
}

export const ResultsPage = () => {
  // Master view state
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSaison, setSelectedSaison] = useState<string>("all");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  
  // Detail view state
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [raceMeta, setRaceMeta] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [myRidersFirst, setMyRidersFirst] = useState(false);

  useEffect(() => {
    loadRaces();
  }, [selectedSaison, selectedPhase, searchQuery]);

  useEffect(() => {
    if (selectedRace && selectedType) {
      loadRaceResults();
    }
  }, [selectedRace, selectedType, selectedEtape]);

  const loadRaces = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('results-recent-races', {
        body: { 
          limit: 24,
          search: searchQuery || null,
          saison_id: selectedSaison !== "all" ? selectedSaison : null,
          phase_id: selectedPhase !== "all" ? selectedPhase : null
        }
      });

      if (error) throw error;
      const racesList = data.races || [];
      setRaces(racesList);
      
      // Auto-select first race if none selected
      if (racesList.length > 0 && !selectedRace) {
        selectRace(racesList[0]);
      }
    } catch (error) {
      console.error('Error loading races:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectRace = async (race: Race) => {
    setSelectedRace(race);
    setLoadingResults(true);

    try {
      const { data, error } = await supabase.functions.invoke('results-course-meta', {
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
      const { data, error } = await supabase.functions.invoke('results-course-table', {
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

  const displayedResults = myRidersFirst 
    ? [...results].sort((a, b) => {
        if (a.is_my_rider && !b.is_my_rider) return -1;
        if (!a.is_my_rider && b.is_my_rider) return 1;
        return 0;
      })
    : results;

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold">Résultats</h1>
            <p className="text-muted-foreground">
              {races.length} course{races.length > 1 ? 's' : ''} avec résultats
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select value={selectedSaison} onValueChange={setSelectedSaison}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les saisons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les saisons</SelectItem>
              {/* Will be populated from DB later */}
            </SelectContent>
          </Select>
          
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les phases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les phases</SelectItem>
              {/* Will be populated from DB later */}
            </SelectContent>
          </Select>
          
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Master: Grille des courses */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold">Courses récentes</h2>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : races.length === 0 ? (
            <Card className="p-8 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Aucune course trouvée</h3>
              <p className="text-sm text-muted-foreground">
                Aucune course avec résultats pour ces filtres
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSaison("all");
                  setSelectedPhase("all");
                }}
              >
                Réinitialiser
              </Button>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
              {races.map((race) => (
                <Card 
                  key={race.course_id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedRace?.course_id === race.course_id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => selectRace(race)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{race.nom}</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(race.date_debut).toLocaleDateString('fr-FR')} 
                      {' → '}
                      {new Date(race.date_fin).toLocaleDateString('fr-FR')}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {race.types.map((type) => (
                        <Badge key={type} variant="outline" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{race.categorie}</Badge>
                      {race.has_points ? (
                        <div className="text-xs font-medium flex items-center gap-1">
                          <Medal className="h-3 w-3" />
                          Mes points: {race.my_points}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          Points en attente
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail: Classement de la course */}
        <div className="lg:col-span-2 space-y-4">
          {selectedRace ? (
            <>
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{selectedRace.nom}</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Badge variant="secondary">{selectedRace.categorie}</Badge>
                    <span>•</span>
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedRace.date_debut).toLocaleDateString('fr-FR')} 
                    {' - '}
                    {new Date(selectedRace.date_fin).toLocaleDateString('fr-FR')}
                  </div>
                </div>

                {/* Type selector pills */}
                <div className="flex flex-wrap gap-2">
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

                {/* Etape selector if applicable */}
                {selectedType === "Etape" && raceMeta?.etapes_disponibles?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label>Étape:</Label>
                    <Select 
                      value={selectedEtape?.toString() || ""} 
                      onValueChange={(v) => setSelectedEtape(parseInt(v))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {raceMeta.etapes_disponibles.map((etape: number) => (
                          <SelectItem key={etape} value={etape.toString()}>
                            Étape {etape}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* My riders first toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    id="my-riders-first"
                    checked={myRidersFirst}
                    onCheckedChange={setMyRidersFirst}
                  />
                  <Label htmlFor="my-riders-first" className="cursor-pointer">
                    Mes coureurs en premier
                  </Label>
                </div>
              </div>

              {/* Results grid */}
              {loadingResults ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-40 w-full" />
                  ))}
                </div>
              ) : displayedResults.length === 0 ? (
                <Card className="p-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">Aucun classement disponible</h3>
                  <p className="text-sm text-muted-foreground">
                    Pas de résultats pour ce type de classement
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                  {displayedResults.map((result) => (
                    <Card 
                      key={result.race_result_id}
                      className={`relative ${
                        result.is_my_rider ? 'ring-2 ring-primary/50 bg-primary/5' : ''
                      }`}
                    >
                      {result.is_my_rider && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" className="gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            Mon équipe
                          </Badge>
                        </div>
                      )}
                      
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <Avatar className="h-16 w-16">
                            <AvatarFallback className="text-lg font-bold">
                              {getInitials(result.coureur_nom)}
                            </AvatarFallback>
                          </Avatar>

                          {/* Info */}
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Position or Status */}
                            <div>
                              {result.row_position ? (
                                <div className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full h-8 w-8 text-lg font-bold">
                                  {result.row_position}
                                </div>
                              ) : (
                                getStatutBadge(result.statut)
                              )}
                            </div>

                            {/* Rider name */}
                            <div className="font-bold text-lg truncate">
                              {result.coureur_nom}
                            </div>

                            {/* Team */}
                            <Badge variant="secondary" className="text-xs">
                              {result.equipe || 'Équipe inconnue'}
                            </Badge>

                            {/* Manager */}
                            <div className="text-sm text-muted-foreground">
                              Manager: {result.manager_nom || '—'}
                            </div>

                            {/* Points */}
                            <div className="flex items-center gap-2">
                              <Medal className="h-4 w-4 text-primary" />
                              <span className="font-bold text-xl">
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
            </>
          ) : (
            <Card className="p-12 text-center">
              <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Sélectionnez une course</h3>
              <p className="text-muted-foreground">
                Choisissez une course dans la liste pour voir les classements
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

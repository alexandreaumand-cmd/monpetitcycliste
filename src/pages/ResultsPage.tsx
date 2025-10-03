import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trophy, Calendar, ChevronRight, Search, Filter, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

interface FeedResult {
  result_date: string;
  course_id: string;
  course_nom: string;
  course_categorie: string;
  type_classement: string;
  etape_numero: number | null;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  row_position: number | null;
  statut: string;
  manager_id: string | null;
  manager_nom: string | null;
  points_officiels: number | null;
  points_affiches: number;
  is_official_points: boolean;
}

interface RaceResult {
  race_result_id: string;
  row_position: number;
  statut: string;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  manager_id: string;
  manager_nom: string;
  points_theoriques: number;
  points_officiels: number;
  is_my_rider: boolean;
}

export const ResultsPage = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [raceMeta, setRaceMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  
  // Feed view state
  const [feedResults, setFeedResults] = useState<FeedResult[]>([]);
  const [filteredFeed, setFilteredFeed] = useState<FeedResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showMyRidersOnly, setShowMyRidersOnly] = useState(false);
  const [currentManagerId, setCurrentManagerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"feed" | "race">("feed");

  useEffect(() => {
    loadFeed();
    loadCurrentManager();
  }, []);
  
  useEffect(() => {
    if (viewMode === "race" && races.length === 0) {
      loadRaces();
    }
  }, [viewMode]);
  
  useEffect(() => {
    applyFilters();
  }, [feedResults, searchQuery, filterType, showMyRidersOnly, currentManagerId]);

  useEffect(() => {
    if (viewMode === "race" && selectedRace && selectedType) {
      loadRaceResults();
    }
  }, [selectedRace, selectedType, selectedEtape]);

  const loadCurrentManager = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (manager) {
        setCurrentManagerId(manager.id);
      }
    } catch (error) {
      console.error('Error loading manager:', error);
    }
  };

  const loadFeed = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('results-latest-feed', {
        body: { limit: 50 }
      });

      if (error) throw error;
      setFeedResults(data.feed || []);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    let filtered = [...feedResults];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.course_nom.toLowerCase().includes(query) ||
        r.coureur_nom.toLowerCase().includes(query) ||
        r.manager_nom?.toLowerCase().includes(query)
      );
    }
    
    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter(r => r.type_classement === filterType);
    }
    
    // My riders filter
    if (showMyRidersOnly && currentManagerId) {
      filtered = filtered.filter(r => r.manager_id === currentManagerId);
    }
    
    setFilteredFeed(filtered);
  };

  const loadRaces = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('results-recent-races', {
        body: { limit: 20 }
      });

      if (error) throw error;
      setRaces(data.races || []);
      
      // Auto-select first race if available
      if (data.races && data.races.length > 0) {
        selectRace(data.races[0]);
      }
    } catch (error) {
      console.error('Error loading races:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectRace = async (race: Race) => {
    setSelectedRace(race);
    setSelectedType(race.types[0] || "");
    setSelectedEtape(null);

    // Load race metadata
    try {
      const { data, error } = await supabase.functions.invoke('results-course-meta', {
        body: { course_id: race.course_id }
      });

      if (error) throw error;
      setRaceMeta(data.meta);
    } catch (error) {
      console.error('Error loading race meta:', error);
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

  const getStatutBadge = (statut: string) => {
    const config: Record<string, { variant: any; label: string }> = {
      finished: { variant: 'default', label: 'Terminé' },
      dnf: { variant: 'destructive', label: 'Abandon' },
      dns: { variant: 'secondary', label: 'Non-parti' },
      dsq: { variant: 'destructive', label: 'Disqualifié' }
    };
    const { variant, label } = config[statut] || { variant: 'secondary', label: statut?.toUpperCase() || 'N/A' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading && viewMode === "race") {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Résultats</h1>
          <p className="text-muted-foreground">
            Consultez les résultats des courses récentes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "feed" ? "default" : "outline"}
            onClick={() => setViewMode("feed")}
            size="sm"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Fil d'actualité
          </Button>
          <Button
            variant={viewMode === "race" ? "default" : "outline"}
            onClick={() => setViewMode("race")}
            size="sm"
          >
            <Trophy className="h-4 w-4 mr-2" />
            Par course
          </Button>
        </div>
      </div>

      {viewMode === "feed" ? (
        <div className="space-y-4">
          {/* Filters bar */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher course, coureur, manager..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Type de classement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="General">Général</SelectItem>
                      <SelectItem value="Etape">Étape</SelectItem>
                      <SelectItem value="Points">Points</SelectItem>
                      <SelectItem value="Montagne">Montagne</SelectItem>
                      <SelectItem value="Jeune">Jeune</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center gap-2 px-3 border rounded-md">
                    <Switch
                      id="my-riders"
                      checked={showMyRidersOnly}
                      onCheckedChange={setShowMyRidersOnly}
                    />
                    <Label htmlFor="my-riders" className="cursor-pointer">
                      Mes coureurs uniquement
                    </Label>
                  </div>
                </div>
                
                {(searchQuery || filterType !== "all" || showMyRidersOnly) && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{filteredFeed.length} résultat{filteredFeed.length > 1 ? 's' : ''}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setFilterType("all");
                        setShowMyRidersOnly(false);
                      }}
                    >
                      Réinitialiser
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Results feed */}
          {loading ? (
            <div className="flex justify-center items-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredFeed.length === 0 ? (
            <Card className="p-12 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Aucun résultat trouvé</h3>
              <p className="text-muted-foreground mb-4">
                {feedResults.length === 0 
                  ? "Aucune course avec résultats pour le moment"
                  : "Essayez d'ajuster vos filtres"}
              </p>
              {(searchQuery || filterType !== "all" || showMyRidersOnly) && (
                <Button variant="outline" onClick={() => {
                  setSearchQuery("");
                  setFilterType("all");
                  setShowMyRidersOnly(false);
                }}>
                  Réinitialiser les filtres
                </Button>
              )}
            </Card>
          ) : (
            <Card>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Pos./Statut</TableHead>
                      <TableHead>Coureur</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeed.map((result, idx) => {
                      const isMyRider = currentManagerId && result.manager_id === currentManagerId;
                      return (
                        <TableRow key={`${result.course_id}-${result.coureur_id}-${result.type_classement}-${idx}`}
                          className={isMyRider ? "bg-primary/5" : ""}>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(result.result_date).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{result.course_nom}</div>
                              <Badge variant="secondary" className="text-xs mt-1">
                                {result.course_categorie}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {result.type_classement}
                              {result.etape_numero && ` #${result.etape_numero}`}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {result.row_position ? (
                              <span className="font-bold text-lg">{result.row_position}</span>
                            ) : (
                              getStatutBadge(result.statut)
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {result.coureur_nom}
                                {isMyRider && (
                                  <Badge variant="outline" className="ml-2 text-xs">Mon coureur</Badge>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-xs mt-1">
                                {result.equipe}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {result.manager_nom || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-semibold text-lg">
                                {result.points_affiches}
                              </span>
                              <Badge 
                                variant={result.is_official_points ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {result.is_official_points ? "Officiel" : "Barème"}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des courses */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Courses récentes</CardTitle>
              <CardDescription>{races.length} courses avec résultats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {races.map((race) => (
                <Button
                  key={race.course_id}
                  variant={selectedRace?.course_id === race.course_id ? "default" : "outline"}
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => selectRace(race)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{race.nom}</div>
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <Badge variant="secondary" className="text-xs">{race.categorie}</Badge>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(race.date_fin).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {race.has_points && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        Points distribués
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 ml-2 flex-shrink-0" />
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Résultats de la course sélectionnée */}
          <Card className="lg:col-span-2">
            {selectedRace ? (
              <>
                <CardHeader>
                  <CardTitle>{selectedRace.nom}</CardTitle>
                  <CardDescription>
                    {selectedRace.categorie} • {new Date(selectedRace.date_debut).toLocaleDateString('fr-FR')} - {new Date(selectedRace.date_fin).toLocaleDateString('fr-FR')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={selectedType} onValueChange={setSelectedType}>
                    <TabsList className="mb-4">
                      {selectedRace.types.map((type) => (
                        <TabsTrigger key={type} value={type}>
                          {type}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {selectedType === 'Etape' && raceMeta?.etapes_disponibles && raceMeta.etapes_disponibles.length > 0 && (
                      <div className="flex gap-2 mb-4 flex-wrap">
                        {raceMeta.etapes_disponibles.map((etape: number) => (
                          <Button
                            key={etape}
                            size="sm"
                            variant={selectedEtape === etape ? "default" : "outline"}
                            onClick={() => setSelectedEtape(etape)}
                          >
                            Étape {etape}
                          </Button>
                        ))}
                      </div>
                    )}

                    <TabsContent value={selectedType} className="mt-0">
                      {loadingResults ? (
                        <div className="flex justify-center p-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : results.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground">
                          Aucun résultat disponible
                        </div>
                      ) : (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-16">Pos.</TableHead>
                                <TableHead>Coureur</TableHead>
                                <TableHead>Équipe</TableHead>
                                <TableHead>Manager</TableHead>
                                <TableHead className="text-right">Points</TableHead>
                                <TableHead>Statut</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {results.map((result) => (
                                <TableRow 
                                  key={result.race_result_id}
                                  className={result.is_my_rider ? "bg-primary/5" : ""}
                                >
                                  <TableCell className="font-bold">
                                    {result.row_position || '-'}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {result.coureur_nom}
                                    {result.is_my_rider && (
                                      <Badge variant="outline" className="ml-2 text-xs">Mon coureur</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{result.equipe || '-'}</Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {result.manager_nom || '-'}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {result.points_officiels !== null ? result.points_officiels : result.points_theoriques}
                                  </TableCell>
                                  <TableCell>
                                    {getStatutBadge(result.statut)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center min-h-[400px] text-muted-foreground">
                Sélectionnez une course pour voir les résultats
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

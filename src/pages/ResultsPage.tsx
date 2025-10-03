import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, Calendar, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  useEffect(() => {
    loadRaces();
  }, []);

  useEffect(() => {
    if (selectedRace && selectedType) {
      loadRaceResults();
    }
  }, [selectedRace, selectedType, selectedEtape]);

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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Résultats</h1>
        <p className="text-muted-foreground">
          Consultez les résultats des courses récentes
        </p>
      </div>

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
    </div>
  );
};

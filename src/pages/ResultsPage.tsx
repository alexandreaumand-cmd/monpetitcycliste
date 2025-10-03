import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";

export const ResultsPage = () => {
  const [saisons, setSaisons] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [selectedSaison, setSelectedSaison] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [search, setSearch] = useState("");
  const [races, setRaces] = useState<any[]>([]);
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const [raceResults, setRaceResults] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [loadingRaces, setLoadingRaces] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    loadSaisons();
  }, []);

  useEffect(() => {
    if (selectedSaison) {
      loadPhases();
    }
  }, [selectedSaison]);

  useEffect(() => {
    loadRaces();
  }, [selectedSaison, selectedPhase, search]);

  useEffect(() => {
    if (selectedRace && selectedType) {
      loadRaceResults();
      loadLeaderboard();
    }
  }, [selectedRace, selectedType, selectedEtape]);

  const loadSaisons = async () => {
    const { data } = await supabase
      .from('saisons')
      .select('*')
      .order('annee', { ascending: false });
    setSaisons(data || []);
  };

  const loadPhases = async () => {
    const { data } = await supabase
      .from('phases')
      .select('*')
      .eq('saison_id', selectedSaison)
      .order('index_dans_saison');
    setPhases(data || []);
  };

  const loadRaces = async () => {
    setLoadingRaces(true);
    try {
      const { data, error } = await supabase.functions.invoke('results-recent-races', {
        body: {
          saison_id: selectedSaison || null,
          phase_id: selectedPhase || null,
          search: search || null,
          limit: 12
        }
      });

      if (error) throw error;
      setRaces(data.races || []);
      
      // Auto-select first race
      if (data.races && data.races.length > 0 && !selectedRace) {
        handleSelectRace(data.races[0]);
      }
    } catch (error) {
      console.error('Error loading races:', error);
    } finally {
      setLoadingRaces(false);
    }
  };

  const handleSelectRace = (race: any) => {
    setSelectedRace(race);
    // Default to "General" if available, otherwise first type
    const defaultType = race.types.includes('General') ? 'General' : race.types[0];
    setSelectedType(defaultType);
    
    // If Etape, select the last one
    if (defaultType === 'Etape') {
      setSelectedEtape(null); // Will be set after loading results
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
      setRaceResults(data);
      
      // Auto-select last etape if not already selected
      if (selectedType === 'Etape' && !selectedEtape && data.meta.etapes_disponibles.length > 0) {
        setSelectedEtape(data.meta.etapes_disponibles[data.meta.etapes_disponibles.length - 1]);
      }
    } catch (error) {
      console.error('Error loading race results:', error);
    } finally {
      setLoadingResults(false);
    }
  };

  const loadLeaderboard = async () => {
    if (!selectedRace) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('results-course-leaderboard', {
        body: {
          course_id: selectedRace.course_id
        }
      });

      if (error) throw error;
      setLeaderboard(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, any> = {
      finished: 'default',
      dnf: 'destructive',
      dns: 'secondary',
      dsq: 'destructive'
    };
    return (
      <Badge variant={variants[statut] || 'secondary'}>
        {statut.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Résultats</h1>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select value={selectedSaison} onValueChange={setSelectedSaison}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Toutes les saisons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes les saisons</SelectItem>
              {saisons.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.annee}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedSaison && (
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Toutes les phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes les phases</SelectItem>
                {phases.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    Phase {p.index_dans_saison}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input
            placeholder="Rechercher une course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[250px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Recent races */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold">Dernières courses</h2>
          {loadingRaces ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {races.map((race) => (
                <Card
                  key={race.course_id}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedRace?.course_id === race.course_id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleSelectRace(race)}
                >
                  <div className="space-y-2">
                    <h3 className="font-semibold">{race.nom}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(race.date_debut), 'dd MMM', { locale: fr })} → {format(new Date(race.date_fin), 'dd MMM yyyy', { locale: fr })}
                    </p>
                    <Badge variant="outline">{race.categorie}</Badge>
                    <div className="flex flex-wrap gap-1">
                      {race.types.map((type: string) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                    <div className="pt-2 border-t">
                      {race.has_points ? (
                        <Badge variant="default">Mes points: {race.my_points}</Badge>
                      ) : (
                        <Badge variant="secondary">Points en attente</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right column - Race details */}
        <div className="lg:col-span-2 space-y-4">
          {selectedRace && (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">{raceResults?.meta.course_nom}</h2>
                <p className="text-muted-foreground">
                  {raceResults && format(new Date(raceResults.meta.date_debut), 'dd MMM', { locale: fr })} → {raceResults && format(new Date(raceResults.meta.date_fin), 'dd MMM yyyy', { locale: fr })}
                </p>
                <Badge>{raceResults?.meta.categorie}</Badge>
              </div>

              {/* Type tabs */}
              <Tabs value={selectedType} onValueChange={setSelectedType}>
                <TabsList>
                  {raceResults?.meta.types_disponibles.map((type: string) => (
                    <TabsTrigger key={type} value={type}>{type}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Etape selector */}
              {selectedType === 'Etape' && raceResults?.meta.etapes_disponibles.length > 0 && (
                <Select value={selectedEtape?.toString() || ""} onValueChange={(v) => setSelectedEtape(parseInt(v))}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sélectionner étape" />
                  </SelectTrigger>
                  <SelectContent>
                    {raceResults.meta.etapes_disponibles.map((num: number) => (
                      <SelectItem key={num} value={num.toString()}>
                        Étape {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Results table */}
              {loadingResults ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : raceResults && (
                <Card className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pos.</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Coureur</TableHead>
                        <TableHead>Équipe</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Manager</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {raceResults.rows.map((row: any, idx: number) => (
                        <TableRow 
                          key={idx}
                          className={row.is_my_rider ? 'bg-primary/10' : ''}
                        >
                          <TableCell>{row.position || '-'}</TableCell>
                          <TableCell>{getStatutBadge(row.statut)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {row.coureur_nom}
                              {row.is_my_rider && (
                                <Badge variant="default" className="text-xs">Mon équipe</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.equipe}</Badge>
                          </TableCell>
                          <TableCell>
                            {row.points_officiels !== null ? (
                              <span className="font-semibold">{row.points_officiels}</span>
                            ) : row.points_theoriques > 0 ? (
                              <span className="text-muted-foreground">
                                {row.points_theoriques} <Badge variant="secondary" className="text-xs ml-1">théorique</Badge>
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{row.manager_nom || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}

              {/* Leaderboard */}
              {leaderboard && leaderboard.leaders.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-lg font-semibold mb-4">
                    Classement managers
                    {!leaderboard.is_official && (
                      <Badge variant="secondary" className="ml-2 text-xs">Points théoriques en attente de calcul</Badge>
                    )}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Manager</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.leaders.map((leader: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{leader.manager_nom}</TableCell>
                          <TableCell className="text-right font-semibold">{leader.total_points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

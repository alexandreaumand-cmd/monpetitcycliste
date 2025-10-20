import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, Users, TrendingUp, Info, ArrowUpDown, Download, CheckCircle2, AlertCircle, Trophy, Gift, Award, Mountain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { normalizeString } from "@/lib/stringUtils";
import { computeRiderROI, formatROICompact } from "@/domain/stats/roi";

type TopRidersProps = {
  phaseId?: string | null;
  saisonId?: string | null;
  limit?: number;
};

type RiderOwner = {
  manager_id: string;
  manager_nom: string;
};

type RiderOwnerByPhase = RiderOwner & {
  phase_id: string;
  phase_index: number;
};

type TopRider = {
  rider_id: string;
  rider_nom: string;
  rider_equipe: string;
  prix_achat?: number;
  total_points: number;
  courses_count: number;
  ratio_points_par_prix?: number;
  owners?: RiderOwner[];
  owners_all?: RiderOwner[];
  owners_by_phase?: Record<string, RiderOwner[]> | RiderOwnerByPhase[];
};

type RiderPointRow = {
  phase_id: string | null;
  phase_nom: string;
  phase_index: number;
  course_nom: string;
  course_categorie?: string;
  course_date?: string;
  type_classement: string;
  etape_numero?: number;
  position?: number | null;
  commentaire?: string;
  points: number;
  is_bonus: boolean;
};

type RiderPointsTableData = {
  rider: {
    id: string;
    nom: string;
    equipe: string;
    total_points: number;
  };
  rows: RiderPointRow[];
  total: number;
  total_points: number;
};

type UpcomingRace = {
  race_id: string;
  race_nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  is_confirmed: boolean;
};

type TopRidersSortColumn = "total_points" | "prix_achat" | "ratio_points_par_prix";

export const TopRiders = ({ phaseId, saisonId, limit = 20 }: TopRidersProps) => {
  const [selectedRider, setSelectedRider] = useState<TopRider | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [riderSearchTerm, setRiderSearchTerm] = useState("");
  const [hideRidersWithoutManagers, setHideRidersWithoutManagers] = useState(false);
  const [sortColumn, setSortColumn] = useState<TopRidersSortColumn>("total_points");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [detailsSortColumn, setDetailsSortColumn] = useState<keyof RiderPointRow>("points");
  const [detailsSortDirection, setDetailsSortDirection] = useState<"asc" | "desc">("desc");
  const [displayLimit, setDisplayLimit] = useState(20);

  const { data: allRiders, isLoading } = useQuery({
    queryKey: ["top-riders", phaseId, saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-top-riders', {
        body: {
          phase_id: phaseId,
          saison_id: saisonId,
          limit: 5000,
        },
      });

      if (error) throw error;
      return data?.items as TopRider[] || [];
    },
  });

  const riders = allRiders?.slice(0, displayLimit);

  const { data: riderPointsData, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["rider-points-table", selectedRider?.rider_id, phaseId, saisonId],
    queryFn: async () => {
      if (!selectedRider) return null;

      const { data, error } = await supabase.functions.invoke('get-rider-points-table', {
        body: {
          rider_id: selectedRider.rider_id,
          phase_id: phaseId,
          saison_id: saisonId,
        },
      });

      if (error) throw error;
      return data as RiderPointsTableData;
    },
    enabled: !!selectedRider,
  });

  const { data: upcomingRaces, isLoading: isLoadingUpcoming } = useQuery({
    queryKey: ["rider-upcoming-races", selectedRider?.rider_id],
    queryFn: async () => {
      if (!selectedRider) return [];
      
      const { data, error } = await supabase.functions.invoke('get-rider-upcoming-races', {
        body: { rider_id: selectedRider.rider_id }
      });
      
      if (error) throw error;
      return data?.races as UpcomingRace[] || [];
    },
    enabled: !!selectedRider && detailsOpen,
  });

  const { data: phaseMeta } = useQuery({
    queryKey: ["phase-meta", phaseId],
    queryFn: async () => {
      if (!phaseId) return null;
      const { data, error } = await supabase
        .from("phases")
        .select("index_dans_saison")
        .eq("id", phaseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!phaseId,
  });
  
  const phaseLabelFromDb = phaseMeta ? `Phase ${phaseMeta.index_dans_saison}` : undefined;

  // Sort riders list
  const sortedRiders = useMemo(() => {
    if (!riders) return [];
    
    return [...riders].sort((a, b) => {
      const aVal = a[sortColumn] ?? 0;
      const bVal = b[sortColumn] ?? 0;
      
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });
  }, [riders, sortColumn, sortDirection]);

  // Filter riders by search term and manager ownership
  const filteredRiders = useMemo(() => {
    let filtered = sortedRiders;
    
    // Filter by search term (rider name or team)
    if (riderSearchTerm) {
      const searchNormalized = normalizeString(riderSearchTerm);
      filtered = filtered.filter(rider => 
        normalizeString(rider.rider_nom).includes(searchNormalized) ||
        normalizeString(rider.rider_equipe || '').includes(searchNormalized)
      );
    }
    
    // Filter out riders without managers
    if (hideRidersWithoutManagers) {
      filtered = filtered.filter(rider => {
        if (phaseId) {
          return rider.owners && rider.owners.length > 0;
        } else {
          return rider.owners_all && rider.owners_all.length > 0;
        }
      });
    }
    
    return filtered;
  }, [sortedRiders, riderSearchTerm, hideRidersWithoutManagers, phaseId]);

  const hasMoreRiders = allRiders && allRiders.length > displayLimit;

  // Group rider points data by phase
  const groupedByPhase = useMemo(() => {
    if (!riderPointsData?.rows) return { phases: [], bonus: [] };
    
    let filtered = riderPointsData.rows;
    
    if (searchTerm) {
      filtered = filtered.filter(row => 
        row.course_nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.type_classement.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Separate bonus points
    const bonus = filtered.filter(row => row.is_bonus);
    const racePoints = filtered.filter(row => !row.is_bonus);
    
    // Group by phase
    const phaseMap = new Map<string, { 
      phase_id: string;
      phase_nom: string;
      phase_index: number;
      total_points: number;
      courses: Map<string, RiderPointRow[]>;
    }>();
    
    racePoints.forEach(row => {
      const phaseKey = row.phase_id || 'unknown';
      if (!phaseMap.has(phaseKey)) {
        phaseMap.set(phaseKey, {
          phase_id: row.phase_id || '',
          phase_nom: row.phase_nom 
            || (row.phase_index ? `Phase ${row.phase_index}` : (phaseLabelFromDb || 'Phase inconnue')),
          phase_index: row.phase_index || 0,
          total_points: 0,
          courses: new Map()
        });
      }
      
      const phase = phaseMap.get(phaseKey)!;
      phase.total_points += row.points;
      
      const courseKey = row.course_nom;
      if (!phase.courses.has(courseKey)) {
        phase.courses.set(courseKey, []);
      }
      phase.courses.get(courseKey)!.push(row);
    });
    
    // Convert to array and sort by phase index
    const phases = Array.from(phaseMap.values()).sort((a, b) => a.phase_index - b.phase_index);
    
    return { phases, bonus };
  }, [riderPointsData?.rows, searchTerm, phaseLabelFromDb]);
  
  // Calculate statistics
  const riderStats = useMemo(() => {
    if (!riderPointsData?.rows) return { wins: 0, top10: 0, totalRaces: 0 };
    
    const raceResults = riderPointsData.rows.filter(r => !r.is_bonus);
    
    // Les types "Porteur" ne comptent pas comme victoires
    const porteurTypes = [
      'Porteur Général', 
      'Porteur Vert', 
      'Porteur Montagne', 
      'Porteur Jeune', 
      'Porteur Combattif'
    ];
    
    const wins = raceResults.filter(r => 
      r.position === 1 && 
      !porteurTypes.includes(r.type_classement)
    ).length;
    
    const uniqueCourses = new Set(raceResults.map(r => r.course_nom));
    
    return {
      wins,
      top10: raceResults.filter(r => r.points > 0).length,
      totalRaces: uniqueCourses.size
    };
  }, [riderPointsData?.rows]);

  const handleSort = (column: TopRidersSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };


  const handleExportCSV = () => {
    if (!riderPointsData) return;

    const csv = [
      ['Phase', 'Course', 'Type', 'Étape', 'Position', 'Points'],
      ...riderPointsData.rows.map(row => [
        row.phase_nom || (row.phase_index ? `Phase ${row.phase_index}` : (phaseLabelFromDb || 'Phase inconnue')),
        row.course_nom,
        row.type_classement,
        row.etape_numero?.toString() || '',
        row.position?.toString() || '',
        row.points.toString(),
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedRider?.rider_nom}_points.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRiderClick = (rider: TopRider) => {
    setSelectedRider(rider);
    setDetailsOpen(true);
    setSearchTerm("");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  const SortIcon = ({ column }: { column: TopRidersSortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return <ArrowUpDown className="h-4 w-4 ml-1" />;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Top Coureurs
          </CardTitle>
          <CardDescription>
            {phaseId ? "Meilleurs coureurs de la phase" : "Meilleurs coureurs toutes phases"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!riders || riders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun point pour la période sélectionnée
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                <Input
                  placeholder="Rechercher un coureur ou une équipe..."
                  value={riderSearchTerm}
                  onChange={(e) => setRiderSearchTerm(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Switch
                    id="hide-no-managers"
                    checked={hideRidersWithoutManagers}
                    onCheckedChange={setHideRidersWithoutManagers}
                  />
                  <Label htmlFor="hide-no-managers" className="cursor-pointer">
                    Masquer les coureurs sans manager
                  </Label>
                </div>
              </div>
              
              {filteredRiders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun coureur ne correspond à votre recherche
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Coureur</TableHead>
                    <TableHead>Équipe</TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("total_points")}
                    >
                      <div className="flex items-center justify-end">
                        Points
                        <SortIcon column="total_points" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("prix_achat")}
                    >
                      <div className="flex items-center justify-end">
                        Prix
                        <SortIcon column="prix_achat" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("ratio_points_par_prix")}
                    >
                      <div className="flex items-center justify-end">
                        Ratio
                        <SortIcon column="ratio_points_par_prix" />
                      </div>
                    </TableHead>
                    <TableHead>Managers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRiders.map((rider, idx) => (
                    <TableRow
                      key={rider.rider_id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleRiderClick(rider)}
                    >
                      <TableCell>
                        <Badge 
                          variant={idx < 3 ? "default" : "secondary"}
                          className="w-10 justify-center"
                        >
                          {idx + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{rider.rider_nom}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {rider.rider_equipe || '—'}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {rider.total_points}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {rider.prix_achat ? rider.prix_achat.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {rider.ratio_points_par_prix !== undefined 
                          ? formatROICompact(computeRiderROI({
                              pointsTotal: rider.total_points,
                              purchasePriceTotal: rider.prix_achat
                            }))
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {phaseId ? (
                          rider.owners && rider.owners.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {rider.owners.slice(0, 4).map((owner) => (
                                <Badge key={owner.manager_id} variant="outline" className="text-xs">
                                  {owner.manager_nom}
                                </Badge>
                              ))}
                              {rider.owners.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{rider.owners.length - 4}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )
                        ) : (
                          rider.owners_all && rider.owners_all.length > 0 ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              {rider.owners_all.map((owner) => (
                                <Badge key={owner.manager_id} variant="outline" className="text-xs">
                                  {owner.manager_nom}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
              )}
            </>
          )}
          {hasMoreRiders && (
            <div className="flex flex-col gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setDisplayLimit(prev => Math.min(prev + 20, allRiders!.length))}
              >
                Charger 20 de plus ({allRiders!.length - displayLimit} restants)
              </Button>
              {displayLimit >= 40 && (
                <Button
                  variant="ghost"
                  onClick={() => setDisplayLimit(allRiders!.length)}
                >
                  Voir tous ({allRiders!.length})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rider Details Drawer */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {selectedRider?.rider_nom}
            </SheetTitle>
            {selectedRider?.rider_equipe && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                {selectedRider.rider_equipe}
              </p>
            )}
            
            {/* Display owners based on context */}
            {phaseId && selectedRider?.owners && selectedRider.owners.length > 0 ? (
              <div className="pt-2">
                <p className="text-sm font-medium">
                  Propriétaire(s) — Phase : {selectedRider.owners.map(o => o.manager_nom).join(', ')}
                </p>
              </div>
            ) : !phaseId && selectedRider?.owners_all && selectedRider.owners_all.length > 0 ? (
              <div className="pt-2 space-y-2">
                <p className="text-sm font-medium">
                  Propriétaire(s) — Toutes phases : {selectedRider.owners_all.map(o => o.manager_nom).join(', ')}
                </p>
                {selectedRider.owners_by_phase && Object.keys(selectedRider.owners_by_phase).length > 0 && (
                  <Card className="mt-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Historique des managers par phase</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Manager</TableHead>
                            <TableHead className="text-xs">Phase</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(selectedRider.owners_by_phase)
                            .sort(([a], [b]) => {
                              const numA = parseInt(a.replace('P', ''));
                              const numB = parseInt(b.replace('P', ''));
                              return numA - numB;
                            })
                            .flatMap(([phaseKey, owners]) => 
                              (owners as RiderOwner[]).map((owner, idx) => (
                                <TableRow key={`${phaseKey}-${idx}`}>
                                  <TableCell className="text-xs">{owner.manager_nom}</TableCell>
                                  <TableCell className="text-xs">
                                    <Badge variant="outline" className="text-xs">
                                      {phaseKey.replace(/^P(\d+)$/, 'Phase $1')}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Statistics Overview */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{riderPointsData?.total || 0}</div>
                    <div className="text-sm text-muted-foreground">Points totaux</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{riderStats.totalRaces}</div>
                    <div className="text-sm text-muted-foreground">Courses avec points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{riderStats.wins}</div>
                    <div className="text-sm text-muted-foreground">Victoires</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {selectedRider?.prix_achat 
                        ? ((riderPointsData?.total || 0) / selectedRider.prix_achat).toFixed(2)
                        : '0.00'}
                    </div>
                    <div className="text-sm text-muted-foreground">Ratio pts/prix</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Search and Export */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Rechercher une course..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="default" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {isLoadingDetails ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {/* Phases Accordion */}
                {groupedByPhase.phases.map((phase) => {
                  const phasePercentage = riderPointsData?.total 
                    ? (phase.total_points / riderPointsData.total) * 100 
                    : 0;
                  
                  const displayPhaseName = phase.phase_nom && phase.phase_nom !== 'Phase inconnue'
                    ? phase.phase_nom
                    : (phase.phase_index ? `Phase ${phase.phase_index}` : (phaseLabelFromDb || 'Phase inconnue'));
                  
                  return (
                    <AccordionItem 
                      key={phase.phase_id} 
                      value={`phase-${phase.phase_id}`}
                      className="border rounded-lg bg-card"
                    >
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-sm">
                              {displayPhaseName}
                            </Badge>
                            <span className="text-muted-foreground text-sm">
                              {phase.courses.size} course{phase.courses.size > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-32 hidden md:block">
                              <Progress value={phasePercentage} className="h-2" />
                            </div>
                            <Badge className="text-base px-3">
                              {phase.total_points} pts
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <Accordion type="multiple" className="space-y-1">
                          {Array.from(phase.courses.entries()).map(([courseName, results]) => {
                            const courseTotal = results.reduce((sum, r) => sum + r.points, 0);
                            const hasWin = results.some(r => r.position === 1);
                            
                            return (
                              <AccordionItem 
                                key={courseName} 
                                value={`course-${courseName}`}
                                className="border-l-2 border-muted ml-2"
                              >
                                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50 rounded">
                                  <div className="flex items-center justify-between w-full pr-4">
                                    <div className="flex items-center gap-2">
                                      {hasWin && <Trophy className="h-4 w-4 text-yellow-600" />}
                                      <span className="font-medium">{courseName}</span>
                                    </div>
                                    <Badge variant="outline">{courseTotal} pts</Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-3 pb-2">
                                  <div className="space-y-1 ml-4">
                                    {results.map((result, idx) => (
                                      <div 
                                        key={idx}
                                        className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded text-sm"
                                      >
                                        <div className="flex items-center gap-2">
                                          {result.type_classement === 'GC' && <Award className="h-3 w-3 text-primary" />}
                                          {result.type_classement?.includes('Porteur') && <Mountain className="h-3 w-3 text-orange-500" />}
                                          <span className="text-muted-foreground">
                                            {result.type_classement || 'N/A'}
                                            {result.etape_numero ? ` ${result.etape_numero}` : ''}
                                          </span>
                                          {result.position && (
                                            <Badge variant="outline" className="text-xs">
                                              {result.position}ème
                                            </Badge>
                                          )}
                                        </div>
                                        <span className="font-semibold">{result.points} pts</span>
                                      </div>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}

                {/* Bonus Points Section */}
                {groupedByPhase.bonus.length > 0 && (
                  <AccordionItem 
                    value="bonus" 
                    className="border rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20"
                  >
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Gift className="h-5 w-5 text-purple-600" />
                          <span className="font-semibold">Points Bonus</span>
                          <span className="text-muted-foreground text-sm">
                            {groupedByPhase.bonus.length} bonus
                          </span>
                        </div>
                        <Badge className="bg-purple-600 text-base px-3">
                          {groupedByPhase.bonus.reduce((sum, b) => sum + b.points, 0)} pts
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2">
                        {groupedByPhase.bonus.map((bonus, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between py-2 px-3 bg-white/50 dark:bg-black/20 rounded"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{bonus.type_classement}</div>
                              {bonus.commentaire && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {bonus.commentaire}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="font-semibold">
                              +{bonus.points} pts
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            )}

            {/* Programme à venir */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Programme à venir</CardTitle>
                <CardDescription>Courses inscrites sur la startlist</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUpcoming ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : upcomingRaces && upcomingRaces.length > 0 ? (
                  <div className="space-y-2">
                    {upcomingRaces.map((race) => (
                      <div 
                        key={race.race_id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{race.race_nom}</p>
                            {race.is_confirmed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {race.categorie}
                            </Badge>
                            <p className="text-sm text-muted-foreground">
                              {new Date(race.date_debut).toLocaleDateString('fr-FR')}
                              {race.date_debut !== race.date_fin && 
                                ` - ${new Date(race.date_fin).toLocaleDateString('fr-FR')}`
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune course programmée
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

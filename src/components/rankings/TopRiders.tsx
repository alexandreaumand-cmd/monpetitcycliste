import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, Users, TrendingUp, Info, ArrowUpDown, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  phase_label: string;
  course_nom: string;
  place: number | null;
  points: number;
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

  // Filter and sort detail rows
  const filteredAndSortedRows = useMemo(() => {
    if (!riderPointsData?.rows) return [];

    let filtered = riderPointsData.rows;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(row =>
        row.course_nom.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[detailsSortColumn];
      const bVal = b[detailsSortColumn];

      // Handle nulls for place
      if (detailsSortColumn === "place") {
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return detailsSortDirection === "asc" ? 1 : -1;
        if (bVal === null) return detailsSortDirection === "asc" ? -1 : 1;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return detailsSortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return detailsSortDirection === "asc" 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });

    return sorted;
  }, [riderPointsData, searchTerm, detailsSortColumn, detailsSortDirection]);

  const handleSort = (column: TopRidersSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleDetailsSort = (column: keyof RiderPointRow) => {
    if (detailsSortColumn === column) {
      setDetailsSortDirection(detailsSortDirection === "asc" ? "desc" : "asc");
    } else {
      setDetailsSortColumn(column);
      setDetailsSortDirection(column === "points" ? "desc" : "asc");
    }
  };

  const handleExportCSV = () => {
    if (!riderPointsData) return;

    const csv = [
      ['Phase', 'Course', 'Place', 'Points'],
      ...riderPointsData.rows.map(row => [
        row.phase_label,
        row.course_nom,
        row.place?.toString() || '—',
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
    setDetailsSortColumn("points");
    setDetailsSortDirection("desc");
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
                              {rider.owners_all.slice(0, 3).map((owner) => (
                                <Badge key={owner.manager_id} variant="outline" className="text-xs">
                                  {owner.manager_nom}
                                </Badge>
                              ))}
                              {rider.owners_all.length > 3 && (
                                <Popover>
                                  <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Badge 
                                      variant="secondary" 
                                      className="text-xs cursor-pointer hover:bg-secondary/80"
                                    >
                                      +{rider.owners_all.length - 3}
                                      <Info className="h-3 w-3 ml-1" />
                                    </Badge>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80" onClick={(e) => e.stopPropagation()}>
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-sm">Propriétaires par phase</h4>
                                      <div className="max-h-48 overflow-y-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="text-xs">Manager</TableHead>
                                              <TableHead className="text-xs">Phase</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {rider.owners_by_phase && Object.entries(rider.owners_by_phase).flatMap(([phaseId, owners]) => 
                                              (owners as RiderOwner[]).map((owner, idx) => (
                                                <TableRow key={`${phaseId}-${idx}`}>
                                                  <TableCell className="text-xs">{owner.manager_nom}</TableCell>
                                                  <TableCell className="text-xs">{phaseId}</TableCell>
                                                </TableRow>
                                              ))
                                            )}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
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
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Détail — {selectedRider?.rider_nom}
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
                  <div className="mt-2">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Voir détail par phase
                      </summary>
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Manager</TableHead>
                              <TableHead className="text-xs">Phase</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(selectedRider.owners_by_phase).flatMap(([phaseId, owners]) => 
                              (owners as RiderOwner[]).map((owner, idx) => (
                                <TableRow key={`${phaseId}-${idx}`}>
                                  <TableCell className="text-xs">{owner.manager_nom}</TableCell>
                                  <TableCell className="text-xs">{phaseId}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ) : null}
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Total Points Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Points</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{riderPointsData?.rider.total_points || 0}</p>
              </CardContent>
            </Card>

            {/* Points Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Détail des points par course</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={!riderPointsData?.rows.length}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exporter CSV
                  </Button>
                </div>
                <Input
                  placeholder="Rechercher une course..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-2"
                />
              </CardHeader>
              <CardContent>
                {isLoadingDetails ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filteredAndSortedRows.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleDetailsSort("phase_label")}
                          >
                            <div className="flex items-center">
                              Phase
                              {detailsSortColumn === "phase_label" && (
                                <ArrowUpDown className="h-4 w-4 ml-1" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => handleDetailsSort("course_nom")}
                          >
                            <div className="flex items-center gap-1">
                              Course
                              {detailsSortColumn === "course_nom" && (
                                <ArrowUpDown className="h-4 w-4 ml-1" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleDetailsSort("place")}
                          >
                            <div className="flex items-center gap-1">
                              Place
                              {detailsSortColumn === "place" && (
                                <ArrowUpDown className="h-4 w-4 ml-1" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-right cursor-pointer select-none"
                            onClick={() => handleDetailsSort("points")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Points
                              {detailsSortColumn === "points" && (
                                <ArrowUpDown className="h-4 w-4 ml-1" />
                              )}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedRows.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant="outline">{row.phase_label}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{row.course_nom}</TableCell>
                            <TableCell>{row.place !== null ? row.place : '—'}</TableCell>
                            <TableCell className="text-right font-semibold">{row.points}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Aucun résultat pour cette recherche' : 'Aucun point sur cette période'}
                  </div>
                )}
              </CardContent>
            </Card>

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

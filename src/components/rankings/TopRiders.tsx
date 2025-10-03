import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, Users, TrendingUp, Info, ArrowUpDown, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TopRidersProps = {
  phaseId?: string | null;
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
  total_points: number;
  courses_count: number;
  owners?: RiderOwner[];
  owners_all?: RiderOwner[];
  owners_by_phase?: RiderOwnerByPhase[];
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

export const TopRiders = ({ phaseId, limit = 20 }: TopRidersProps) => {
  const [selectedRider, setSelectedRider] = useState<TopRider | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof RiderPointRow>("points");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data: riders, isLoading } = useQuery({
    queryKey: ["top-riders", phaseId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-top-riders', {
        body: {
          phase_id: phaseId,
          limit,
        },
      });

      if (error) throw error;
      return data?.items as TopRider[] || [];
    },
  });

  const { data: riderPointsData, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["rider-points-table", selectedRider?.rider_id, phaseId],
    queryFn: async () => {
      if (!selectedRider) return null;

      const { data, error } = await supabase.functions.invoke('get-rider-points-table', {
        body: {
          rider_id: selectedRider.rider_id,
          phase_id: phaseId,
        },
      });

      if (error) throw error;
      return data as RiderPointsTableData;
    },
    enabled: !!selectedRider,
  });

  // Filter and sort rows
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
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle nulls for place
      if (sortColumn === "place") {
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return sortDirection === "asc" ? 1 : -1;
        if (bVal === null) return sortDirection === "asc" ? -1 : 1;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });

    return sorted;
  }, [riderPointsData, searchTerm, sortColumn, sortDirection]);

  const handleSort = (column: keyof RiderPointRow) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "points" ? "desc" : "asc");
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
    setSortColumn("points");
    setSortDirection("desc");
  };

  const maxPoints = riders?.[0]?.total_points || 1;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {riders?.map((rider, idx) => {
              const progressPercent = (rider.total_points / maxPoints) * 100;
              
              return (
                <Card 
                  key={rider.rider_id} 
                  className="overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleRiderClick(rider)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{rider.rider_nom}</p>
                        {rider.rider_equipe && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {rider.rider_equipe}
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant={idx < 3 ? "default" : "secondary"}
                        className="ml-2 shrink-0"
                      >
                        #{idx + 1}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Points</span>
                        <span className="font-bold">{rider.total_points}</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">
                        {rider.courses_count} {rider.courses_count > 1 ? 'courses' : 'course'}
                      </p>
                    </div>

                    {/* Managers section */}
                    {phaseId ? (
                      // Case A: Specific phase selected
                      rider.owners && rider.owners.length > 0 ? (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Managers</p>
                          <div className="flex flex-wrap gap-1">
                            {rider.owners.slice(0, 2).map((owner) => (
                              <Badge key={owner.manager_id} variant="outline" className="text-xs">
                                {owner.manager_nom}
                              </Badge>
                            ))}
                            {rider.owners.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{rider.owners.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">Managers : —</p>
                        </div>
                      )
                    ) : (
                      // Case B: All phases (phase_id = null)
                      rider.owners_all && rider.owners_all.length > 0 ? (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            Managers (toutes phases)
                          </p>
                          <div className="flex flex-wrap gap-1 items-center">
                            {rider.owners_all.slice(0, 2).map((owner) => (
                              <Badge key={owner.manager_id} variant="outline" className="text-xs">
                                {owner.manager_nom}
                              </Badge>
                            ))}
                            {rider.owners_all.length > 2 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs cursor-pointer hover:bg-secondary/80"
                                  >
                                    +{rider.owners_all.length - 2}
                                    <Info className="h-3 w-3 ml-1" />
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
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
                                          {rider.owners_by_phase?.map((owner, idx) => (
                                            <TableRow key={idx}>
                                              <TableCell className="text-xs">{owner.manager_nom}</TableCell>
                                              <TableCell className="text-xs">P{owner.phase_index}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">Aucun manager</p>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!riders || riders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucun point pour la période sélectionnée
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
                {selectedRider.owners_by_phase && selectedRider.owners_by_phase.length > 0 && (
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
                            {selectedRider.owners_by_phase.map((owner, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs">{owner.manager_nom}</TableCell>
                                <TableCell className="text-xs">P{owner.phase_index}</TableCell>
                              </TableRow>
                            ))}
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
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("phase_label")}
                          >
                            <div className="flex items-center gap-1">
                              Phase
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("course_nom")}
                          >
                            <div className="flex items-center gap-1">
                              Course
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("place")}
                          >
                            <div className="flex items-center gap-1">
                              Place
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-right cursor-pointer select-none"
                            onClick={() => handleSort("points")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Points
                              <ArrowUpDown className="h-3 w-3" />
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
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2, Download, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

interface PointsLedgerRow {
  id: string;
  phase_id: string | null;
  course_id: string | null;
  type_classement: string;
  etape_numero: number | null;
  coureur_id: string | null;
  points: number;
  created_at: string;
  coureur_nom?: string;
  course_nom?: string;
  course_categorie?: string;
  phase_index?: number;
  saison_annee?: number;
  manager_id?: string;
  manager_nom?: string;
  equipe_nom?: string;
}

export const PointsLedgerTable = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Filters
  const [saisonFilter, setSaisonFilter] = useState<string>("");
  const [phaseFilter, setPhaseFilter] = useState<string>("");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [coureurSearch, setCoureurSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState<string>("");
  const [minPoints, setMinPoints] = useState("");
  const [maxPoints, setMaxPoints] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PointsLedgerRow | null>(null);
  const [newPoints, setNewPoints] = useState(0);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<PointsLedgerRow | null>(null);

  // Fetch saisons for filter
  const { data: saisons } = useQuery({
    queryKey: ["saisons-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .order("annee", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch phases for filter (depends on selected saison)
  const { data: phases } = useQuery({
    queryKey: ["phases-list", saisonFilter],
    queryFn: async () => {
      let query = supabase
        .from("phases")
        .select("id, index_dans_saison, saison_id")
        .order("index_dans_saison");
      
      if (saisonFilter) {
        query = query.eq("saison_id", saisonFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!saisonFilter,
  });

  // Fetch managers for filter
  const { data: managers } = useQuery({
    queryKey: ["managers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select("id, nom")
        .order("nom");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch points ledger data
  const { data: rawData, isLoading } = useQuery({
    queryKey: [
      "points-ledger-table",
      saisonFilter,
      phaseFilter,
      courseFilter,
      typeFilter,
      coureurSearch,
      managerFilter,
      minPoints,
      maxPoints,
      globalSearch,
    ],
    queryFn: async () => {
      let query = supabase
        .from("points_ledger")
        .select(`
          *,
          coureurs!points_ledger_coureur_id_fkey (nom),
          courses!points_ledger_course_id_fkey (nom, categorie),
          phases!points_ledger_phase_id_fkey (
            index_dans_saison,
            saison_id,
            saisons!phases_saison_id_fkey (id, annee)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50000);

      // Filtre par saison (via phase_id)
      if (saisonFilter) {
        const phaseIds = phases?.filter(p => p.saison_id === saisonFilter).map(p => p.id) || [];
        if (phaseIds.length > 0) {
          query = query.in("phase_id", phaseIds);
        } else {
          return []; // Aucune phase pour cette saison
        }
      }

      if (phaseFilter) query = query.eq("phase_id", phaseFilter);
      if (courseFilter) query = query.eq("course_id", courseFilter);
      if (typeFilter) query = query.eq("type_classement", typeFilter as any);
      if (minPoints) query = query.gte("points", parseInt(minPoints));
      if (maxPoints) query = query.lte("points", parseInt(maxPoints));

      const { data: directData, error: directError } = await query;
      if (directError) throw directError;

      // Transform data to match expected format
      let results = (directData || []).map((row: any) => ({
        id: row.id,
        phase_id: row.phase_id,
        course_id: row.course_id,
        type_classement: row.type_classement,
        etape_numero: row.etape_numero,
        coureur_id: row.coureur_id,
        points: row.points,
        created_at: row.created_at,
        coureur_nom: row.coureurs?.nom,
        course_nom: row.courses?.nom,
        course_categorie: row.courses?.categorie,
        phase_index: row.phases?.index_dans_saison,
        saison_id: row.phases?.saisons?.id,
        saison_annee: row.phases?.saisons?.annee,
      }));

      // Client-side filtering for coureur search and global search
      if (coureurSearch) {
        const search = coureurSearch.toLowerCase();
        results = results.filter((r: any) => 
          r.coureur_nom?.toLowerCase().includes(search)
        );
      }

      if (globalSearch) {
        const search = globalSearch.toLowerCase();
        results = results.filter((r: any) => 
          r.coureur_nom?.toLowerCase().includes(search) ||
          r.course_nom?.toLowerCase().includes(search) ||
          r.manager_nom?.toLowerCase().includes(search)
        );
      }

      return results as PointsLedgerRow[];
    },
  });

  // Paginated data
  const paginatedData = useMemo(() => {
    if (!rawData) return [];
    const start = page * pageSize;
    return rawData.slice(start, start + pageSize);
  }, [rawData, page, pageSize]);

  // Statistics
  const stats = useMemo(() => {
    if (!rawData) return { totalPoints: 0, totalEntries: 0, uniqueRiders: 0, uniqueCourses: 0 };
    
    const totalPoints = rawData.reduce((sum, row) => sum + (row.points || 0), 0);
    const uniqueRiders = new Set(rawData.map(row => row.coureur_id).filter(Boolean)).size;
    const uniqueCourses = new Set(rawData.map(row => row.course_id).filter(Boolean)).size;
    
    return {
      totalPoints,
      totalEntries: rawData.length,
      uniqueRiders,
      uniqueCourses,
    };
  }, [rawData]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, points }: { id: string; points: number }) => {
      const { error } = await supabase
        .from("points_ledger")
        .update({ points })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-ledger-table"] });
      toast.success("Points mis à jour avec succès");
      setEditDialogOpen(false);
      setSelectedEntry(null);
    },
    onError: (error) => {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("points_ledger")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-ledger-table"] });
      toast.success("Entrée supprimée avec succès");
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    },
  });

  const handleEdit = (entry: PointsLedgerRow) => {
    setSelectedEntry(entry);
    setNewPoints(entry.points);
    setEditDialogOpen(true);
  };

  const handleDelete = (entry: PointsLedgerRow) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    updateMutation.mutate({ id: selectedEntry.id, points: newPoints });
  };

  const handleConfirmDelete = () => {
    if (!entryToDelete) return;
    deleteMutation.mutate(entryToDelete.id);
  };

  const resetFilters = () => {
    setSaisonFilter("");
    setPhaseFilter("");
    setCourseFilter("");
    setTypeFilter("");
    setCoureurSearch("");
    setManagerFilter("");
    setMinPoints("");
    setMaxPoints("");
    setGlobalSearch("");
    setPage(0);
  };

  const exportToCSV = () => {
    if (!rawData) return;
    
    const headers = ["Course", "Coureur", "Manager", "Phase", "Saison", "Type", "Étape", "Points", "Date"];
    const rows = rawData.map(row => [
      row.course_nom || "",
      row.coureur_nom || "",
      row.manager_nom || "",
      row.phase_index || "",
      row.saison_annee || "",
      row.type_classement || "",
      row.etape_numero || "",
      row.points || 0,
      new Date(row.created_at).toLocaleDateString("fr-FR"),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `points-ledger-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV réussi");
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      "Général": "bg-primary",
      "Étape": "bg-blue-500",
      "Points": "bg-green-500",
      "Montagne": "bg-orange-500",
      "Jeunes": "bg-yellow-500",
    };
    return colors[type] || "bg-muted";
  };

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Points</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Entrées</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalEntries}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Recherche globale..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
            
            {saisons && (
              <Select value={saisonFilter} onValueChange={setSaisonFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes saisons" />
                </SelectTrigger>
                <SelectContent>
                  {saisons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.annee}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min pts"
                value={minPoints}
                onChange={(e) => setMinPoints(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Max pts"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
              />
            </div>

            <Button onClick={resetFilters} variant="outline" size="sm" className="w-full">
              Réinitialiser
            </Button>
          </CardContent>
        </Card>

        {/* Cards */}
        <div className="space-y-3">
          {paginatedData.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold">{row.coureur_nom || "—"}</p>
                    <Badge className={getTypeColor(row.type_classement)}>
                      {row.points} pts
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(row)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(row)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Course:</strong> {row.course_nom || "—"}</p>
                <p><strong>Phase:</strong> {row.phase_index ? `Phase ${row.phase_index}` : "—"} • <strong>Saison:</strong> {row.saison_annee || "—"}</p>
                <p><strong>Type:</strong> {row.type_classement}</p>
                {row.etape_numero && <p><strong>Étape:</strong> {row.etape_numero}</p>}
                {row.manager_nom && <p><strong>Manager:</strong> {row.manager_nom}</p>}
                <p className="text-muted-foreground text-xs">
                  {new Date(row.created_at).toLocaleDateString("fr-FR")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {rawData && rawData.length > pageSize && (
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={(page + 1) * pageSize >= rawData.length}
              onClick={() => setPage(p => p + 1)}
            >
              Suivant
            </Button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Modifier les points</DialogTitle>
              <DialogDescription>
                Modifiez les points attribués pour cette entrée
              </DialogDescription>
            </DialogHeader>

            {selectedEntry && (
              <>
                <div className="space-y-2 text-sm">
                  <div><strong>Coureur:</strong> {selectedEntry.coureur_nom} ({selectedEntry.equipe_nom || "—"})</div>
                  <div><strong>Course:</strong> {selectedEntry.course_nom}</div>
                  <div><strong>Type:</strong> {selectedEntry.type_classement}</div>
                  {selectedEntry.etape_numero && <div><strong>Étape:</strong> {selectedEntry.etape_numero}</div>}
                  {selectedEntry.manager_nom && <div><strong>Manager:</strong> {selectedEntry.manager_nom}</div>}
                </div>

                <Separator />

                <form onSubmit={handleSubmitEdit}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="points">Points</Label>
                      <Input
                        id="points"
                        type="number"
                        value={newPoints}
                        onChange={(e) => setNewPoints(parseInt(e.target.value) || 0)}
                        min={0}
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Points actuels : <strong>{selectedEntry.points}</strong>
                        {newPoints !== selectedEntry.points && (
                          <span className={newPoints > selectedEntry.points ? "text-green-600" : "text-red-600"}>
                            {" "}({newPoints > selectedEntry.points ? "+" : ""}{newPoints - selectedEntry.points})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Mise à jour..." : "Sauvegarder"}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette entrée ?</AlertDialogTitle>
              <AlertDialogDescription>
                {entryToDelete && (
                  <div className="space-y-2 mt-2">
                    <p><strong>Coureur:</strong> {entryToDelete.coureur_nom}</p>
                    <p><strong>Course:</strong> {entryToDelete.course_nom}</p>
                    <p><strong>Type:</strong> {entryToDelete.type_classement}</p>
                    <p><strong>Points:</strong> {entryToDelete.points}</p>
                    <p className="text-destructive font-semibold mt-4">
                      ⚠️ Cela supprimera définitivement ces points du classement
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Points Ledger</h1>
          <p className="text-muted-foreground">Gestion des points attribués</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Points</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Entrées</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalEntries}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Coureurs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.uniqueRiders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.uniqueCourses}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Recherche</Label>
              <Input
                placeholder="Recherche globale..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </div>

            {saisons && (
              <div className="space-y-2">
                <Label>Saison</Label>
                <Select value={saisonFilter} onValueChange={setSaisonFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes saisons" />
                  </SelectTrigger>
                  <SelectContent>
                    {saisons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.annee}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Coureur</Label>
              <Input
                placeholder="Nom du coureur..."
                value={coureurSearch}
                onChange={(e) => setCoureurSearch(e.target.value)}
              />
            </div>

            {managers && (
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select value={managerFilter} onValueChange={setManagerFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous managers" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Points min</Label>
              <Input
                type="number"
                placeholder="0"
                value={minPoints}
                onChange={(e) => setMinPoints(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Points max</Label>
              <Input
                type="number"
                placeholder="100"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
              />
            </div>
            <div className="col-span-2 flex items-end">
              <Button onClick={resetFilters} variant="outline" className="w-full">
                Réinitialiser les filtres
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : paginatedData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Aucune entrée trouvée</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Coureur</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Saison</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Étape</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.course_nom || "—"}</p>
                        <p className="text-xs text-muted-foreground">{row.course_categorie}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.coureur_nom || "—"}</p>
                        <p className="text-xs text-muted-foreground">{row.equipe_nom}</p>
                      </div>
                    </TableCell>
                    <TableCell>{row.manager_nom || "—"}</TableCell>
                <TableCell>
                  {row.phase_index ? `Phase ${row.phase_index}` : "—"}
                </TableCell>
                <TableCell>
                  {row.saison_annee || "—"}
                </TableCell>
                <TableCell>
                  <Badge className={getTypeColor(row.type_classement)}>
                    {row.type_classement}
                  </Badge>
                </TableCell>
                    <TableCell>{row.etape_numero || "—"}</TableCell>
                    <TableCell className="text-right font-bold">{row.points}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(row)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(row)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {rawData && rawData.length > pageSize && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            Précédent
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page + 1} / {Math.ceil(rawData.length / pageSize)}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * pageSize >= rawData.length}
            onClick={() => setPage(p => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier les points</DialogTitle>
            <DialogDescription>
              Modifiez les points attribués pour cette entrée
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <>
              <div className="space-y-2 text-sm">
                <div><strong>Coureur:</strong> {selectedEntry.coureur_nom} ({selectedEntry.equipe_nom || "—"})</div>
                <div><strong>Course:</strong> {selectedEntry.course_nom}</div>
                <div><strong>Type:</strong> {selectedEntry.type_classement}</div>
                {selectedEntry.etape_numero && <div><strong>Étape:</strong> {selectedEntry.etape_numero}</div>}
                {selectedEntry.manager_nom && <div><strong>Manager:</strong> {selectedEntry.manager_nom}</div>}
                <div className="text-xs text-muted-foreground">
                  Créé le {new Date(selectedEntry.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>

              <Separator />

              <form onSubmit={handleSubmitEdit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="points">Points</Label>
                    <Input
                      id="points"
                      type="number"
                      value={newPoints}
                      onChange={(e) => setNewPoints(parseInt(e.target.value) || 0)}
                      min={0}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Points actuels : <strong>{selectedEntry.points}</strong>
                      {newPoints !== selectedEntry.points && (
                        <>
                          {" • "}
                          <span className={newPoints > selectedEntry.points ? "text-green-600" : "text-red-600"}>
                            Différence: {newPoints > selectedEntry.points ? "+" : ""}{newPoints - selectedEntry.points}
                            {" "}({((newPoints - selectedEntry.points) / selectedEntry.points * 100).toFixed(1)}%)
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending || newPoints === selectedEntry.points}
                  >
                    {updateMutation.isPending ? "Mise à jour..." : "Sauvegarder"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette entrée de points ?</AlertDialogTitle>
            <AlertDialogDescription>
              {entryToDelete && (
                <div className="space-y-2 mt-2">
                  <p><strong>Coureur:</strong> {entryToDelete.coureur_nom}</p>
                  <p><strong>Course:</strong> {entryToDelete.course_nom}</p>
                  <p><strong>Type:</strong> {entryToDelete.type_classement}</p>
                  {entryToDelete.etape_numero && <p><strong>Étape:</strong> {entryToDelete.etape_numero}</p>}
                  <p><strong>Points:</strong> {entryToDelete.points}</p>
                  {entryToDelete.manager_nom && <p><strong>Manager:</strong> {entryToDelete.manager_nom}</p>}
                  <p className="text-destructive font-semibold mt-4">
                    ⚠️ Cela supprimera définitivement ces points du classement
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

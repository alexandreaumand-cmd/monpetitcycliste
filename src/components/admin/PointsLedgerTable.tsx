import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2, Download, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  const [minPoints, setMinPoints] = useState("");
  const [maxPoints, setMaxPoints] = useState("");
  const [pointsSort, setPointsSort] = useState<"asc" | "desc" | null>(null);
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

  // Fetch phases for filter
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

  // Fetch courses for filter - filtré par saison/phase
  const { data: courses } = useQuery({
    queryKey: ["courses-list", saisonFilter, phaseFilter, phases],
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select("id, nom, phase_id")
        .order("nom");
      
      // Si une phase spécifique est sélectionnée
      if (phaseFilter) {
        query = query.eq("phase_id", phaseFilter);
      } 
      // Sinon, si une saison est sélectionnée, filtrer par les phases de cette saison
      else if (saisonFilter && phases && phases.length > 0) {
        const phaseIds = phases.map(p => p.id);
        query = query.in("phase_id", phaseIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Réinitialiser courseFilter quand saison ou phase change
  useEffect(() => {
    setCourseFilter("");
  }, [saisonFilter, phaseFilter]);

  // Types de classement disponibles
  const typesClassement = [
    "General",
    "Etape",
    "Points",
    "Montagne",
    "Jeunes",
    "Porteur Maillot Vert",
    "Porteur Maillot à Pois",
    "Porteur Maillot Blanc",
    "Porteur Maillot Jaune",
  ];

  // Fetch points ledger data
  const { data: rawData, isLoading } = useQuery({
    queryKey: [
      "points-ledger-table",
      saisonFilter,
      phaseFilter,
      courseFilter,
      typeFilter,
      coureurSearch,
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
        .order("created_at", { ascending: false });

      // Filtre par saison (via phase_id)
      if (saisonFilter) {
        const phaseIds = phases?.filter(p => p.saison_id === saisonFilter).map(p => p.id) || [];
        if (phaseIds.length > 0) {
          query = query.in("phase_id", phaseIds);
        } else {
          return [];
        }
      }

      if (phaseFilter) query = query.eq("phase_id", phaseFilter);
      if (courseFilter) query = query.eq("course_id", courseFilter);
      if (typeFilter) query = query.eq("type_classement", typeFilter as any);
      if (minPoints) query = query.gte("points", parseInt(minPoints));
      if (maxPoints) query = query.lte("points", parseInt(maxPoints));

      // Apply limit at the end
      query = query.limit(50000);

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
          r.course_nom?.toLowerCase().includes(search)
        );
      }

      return results as PointsLedgerRow[];
    },
  });

  const sortedData = useMemo(() => {
    if (!rawData) return [];
    if (!pointsSort) return rawData;
    return [...rawData].sort((a, b) => 
      pointsSort === "asc" ? a.points - b.points : b.points - a.points
    );
  }, [rawData, pointsSort]);

  const paginatedData = useMemo(() => {
    if (!sortedData) return [];
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

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
    },
    onError: (error) => {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    },
  });

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
    setMinPoints("");
    setMaxPoints("");
    setGlobalSearch("");
    setPage(0);
  };

  const exportToCSV = () => {
    if (!rawData) return;
    
    const headers = ["Course", "Coureur", "Phase", "Saison", "Type", "Étape", "Points", "Date"];
    const rows = rawData.map(row => [
      row.course_nom || "",
      row.coureur_nom || "",
      row.phase_index || "",
      row.saison_annee || "",
      row.type_classement || "",
      row.etape_numero || "",
      row.points || "",
      new Date(row.created_at).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `points_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      "General": "bg-blue-100 text-blue-800",
      "Etape": "bg-green-100 text-green-800",
      "Points": "bg-purple-100 text-purple-800",
      "Montagne": "bg-orange-100 text-orange-800",
      "Jeunes": "bg-yellow-100 text-yellow-800",
      "Porteur Maillot Vert": "bg-emerald-100 text-emerald-800",
      "Porteur Maillot à Pois": "bg-red-100 text-red-800",
      "Porteur Maillot Blanc": "bg-gray-100 text-gray-800",
      "Porteur Maillot Jaune": "bg-amber-100 text-amber-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  // Mobile view
  if (isMobile) {
    return (
      <div className="space-y-4 p-4">
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
                      />
                    </div>

                    <DialogFooter>
                      <Button type="submit">Enregistrer</Button>
                    </DialogFooter>
                  </div>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Êtes-vous sûr(e) ?</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer cette entrée ? Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Desktop view
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Registre des Points</h2>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter CSV
        </Button>
      </div>

      {/* Statistics Cards */}
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
            <CardTitle className="text-sm">Coureurs Uniques</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.uniqueRiders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Courses Uniques</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.uniqueCourses}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ligne 1: Recherche, Saison, Phase, Course */}
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
                      <SelectItem key={s.id} value={s.id}>
                        {s.annee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {phases && phases.length > 0 && (
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes phases" />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        Phase {p.index_dans_saison}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {courses && (
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes courses" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Ligne 2: Type, Coureur, Points min, Points max */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Type classement</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous types" />
                </SelectTrigger>
                <SelectContent>
                  {typesClassement.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Coureur</Label>
              <Input
                placeholder="Nom du coureur..."
                value={coureurSearch}
                onChange={(e) => setCoureurSearch(e.target.value)}
              />
            </div>

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
          </div>

          <div className="flex justify-end">
            <Button onClick={resetFilters} variant="outline">
              Réinitialiser les filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Coureur</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Saison</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Étape</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 -mr-2"
                  onClick={() => setPointsSort(current => 
                    current === null ? "desc" : current === "desc" ? "asc" : null
                  )}
                >
                  Points
                  {pointsSort === null && <ArrowUpDown className="ml-1 h-4 w-4" />}
                  {pointsSort === "asc" && <ArrowUp className="ml-1 h-4 w-4" />}
                  {pointsSort === "desc" && <ArrowDown className="ml-1 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.course_nom || "—"}</TableCell>
                <TableCell>{row.coureur_nom || "—"}</TableCell>
                <TableCell>Phase {row.phase_index || "—"}</TableCell>
                <TableCell>{row.saison_annee || "—"}</TableCell>
                <TableCell>
                  <Badge className={getTypeColor(row.type_classement)}>
                    {row.type_classement}
                  </Badge>
                </TableCell>
                <TableCell>{row.etape_numero || "—"}</TableCell>
                <TableCell className="text-right">{row.points}</TableCell>
                <TableCell>{new Date(row.created_at).toLocaleDateString("fr-FR")}</TableCell>
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
                    />
                  </div>

                  <DialogFooter>
                    <Button type="submit">Enregistrer</Button>
                  </DialogFooter>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr(e) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette entrée ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

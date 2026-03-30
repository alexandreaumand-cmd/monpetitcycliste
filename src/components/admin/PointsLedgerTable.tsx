import { Pencil, Trash2, Download, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePointsLedgerFilters, typesClassement } from "@/hooks/usePointsLedgerFilters";
import { usePointsPagination } from "@/hooks/usePointsPagination";
import { usePointsEditState } from "@/components/admin/PointsEditDialog";
import { PointsDialogs } from "@/components/admin/PointsEditDialog";

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

export const PointsLedgerTable = () => {
  const isMobile = useIsMobile();
  const filters = usePointsLedgerFilters();
  const pagination = usePointsPagination(filters.sortedData);
  const editState = usePointsEditState();

  const handleResetAll = () => {
    filters.resetFilters();
    pagination.resetPage();
  };

  // Mobile view
  if (isMobile) {
    return (
      <div className="space-y-4 p-0">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Total Points</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{filters.stats.totalPoints.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Entrées</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{filters.stats.totalEntries}</p></CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" />Filtres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Recherche globale..." value={filters.globalSearch} onChange={(e) => filters.setGlobalSearch(e.target.value)} />
            {filters.saisons && (
              <Select value={filters.saisonFilter} onValueChange={filters.setSaisonFilter}>
                <SelectTrigger><SelectValue placeholder="Toutes saisons" /></SelectTrigger>
                <SelectContent>
                  {filters.saisons.map((s) => (<SelectItem key={s.id} value={s.id}>{s.annee}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Input type="number" placeholder="Min pts" value={filters.minPoints} onChange={(e) => filters.setMinPoints(e.target.value)} />
              <Input type="number" placeholder="Max pts" value={filters.maxPoints} onChange={(e) => filters.setMaxPoints(e.target.value)} />
            </div>
            <Button onClick={handleResetAll} variant="outline" size="sm" className="w-full">Réinitialiser</Button>
          </CardContent>
        </Card>

        {/* Cards */}
        <div className="space-y-3">
          {pagination.paginatedData.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold">{row.coureur_nom || "—"}</p>
                    <Badge className={getTypeColor(row.type_classement)}>{row.points} pts</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => editState.handleEdit(row)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => editState.handleDelete(row)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Course:</strong> {row.course_nom || "—"}</p>
                <p><strong>Phase:</strong> {row.phase_index ? `Phase ${row.phase_index}` : "—"} • <strong>Saison:</strong> {row.saison_annee || "—"}</p>
                <p><strong>Type:</strong> {row.type_classement}</p>
                {row.etape_numero && <p><strong>Étape:</strong> {row.etape_numero}</p>}
                <p className="text-muted-foreground text-xs">{new Date(row.created_at).toLocaleDateString("fr-FR")}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {filters.rawData && filters.rawData.length > pagination.pageSize && (
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" disabled={!pagination.hasPrevPage} onClick={pagination.prevPage}>Précédent</Button>
            <Button size="sm" variant="outline" disabled={!pagination.hasNextPage} onClick={pagination.nextPage}>Suivant</Button>
          </div>
        )}

        <PointsDialogs
          editDialogOpen={editState.editDialogOpen}
          setEditDialogOpen={editState.setEditDialogOpen}
          selectedEntry={editState.selectedEntry}
          newPoints={editState.newPoints}
          setNewPoints={editState.setNewPoints}
          deleteDialogOpen={editState.deleteDialogOpen}
          setDeleteDialogOpen={editState.setDeleteDialogOpen}
          entryToDelete={editState.entryToDelete}
        />
      </div>
    );
  }

  // Desktop view
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Registre des Points</h2>
        <Button onClick={filters.exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />Exporter CSV
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Total Points</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{filters.stats.totalPoints.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Entrées</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{filters.stats.totalEntries}</p></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Coureurs Uniques</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{filters.stats.uniqueRiders}</p></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Courses Uniques</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{filters.stats.uniqueCourses}</p></CardContent></Card>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" />Filtres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Recherche</Label>
              <Input placeholder="Recherche globale..." value={filters.globalSearch} onChange={(e) => filters.setGlobalSearch(e.target.value)} />
            </div>
            {filters.saisons && (
              <div className="space-y-2">
                <Label>Saison</Label>
                <Select value={filters.saisonFilter} onValueChange={filters.setSaisonFilter}>
                  <SelectTrigger><SelectValue placeholder="Toutes saisons" /></SelectTrigger>
                  <SelectContent>{filters.saisons.map((s) => (<SelectItem key={s.id} value={s.id}>{s.annee}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            {filters.phases && filters.phases.length > 0 && (
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={filters.phaseFilter} onValueChange={filters.setPhaseFilter}>
                  <SelectTrigger><SelectValue placeholder="Toutes phases" /></SelectTrigger>
                  <SelectContent>{filters.phases.map((p) => (<SelectItem key={p.id} value={p.id}>Phase {p.index_dans_saison}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            {filters.courses && (
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={filters.courseFilter} onValueChange={filters.setCourseFilter}>
                  <SelectTrigger><SelectValue placeholder="Toutes courses" /></SelectTrigger>
                  <SelectContent>{filters.courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Type classement</Label>
              <Select value={filters.typeFilter} onValueChange={filters.setTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Tous types" /></SelectTrigger>
                <SelectContent>{typesClassement.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Coureur</Label>
              <Input placeholder="Nom du coureur..." value={filters.coureurSearch} onChange={(e) => filters.setCoureurSearch(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Points min</Label>
              <Input type="number" placeholder="0" value={filters.minPoints} onChange={(e) => filters.setMinPoints(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Points max</Label>
              <Input type="number" placeholder="100" value={filters.maxPoints} onChange={(e) => filters.setMaxPoints(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleResetAll} variant="outline">Réinitialiser les filtres</Button>
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
                  onClick={() => filters.setPointsSort(current =>
                    current === null ? "desc" : current === "desc" ? "asc" : null
                  )}
                >
                  Points
                  {filters.pointsSort === null && <ArrowUpDown className="ml-1 h-4 w-4" />}
                  {filters.pointsSort === "asc" && <ArrowUp className="ml-1 h-4 w-4" />}
                  {filters.pointsSort === "desc" && <ArrowDown className="ml-1 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.course_nom || "—"}</TableCell>
                <TableCell>{row.coureur_nom || "—"}</TableCell>
                <TableCell>Phase {row.phase_index || "—"}</TableCell>
                <TableCell>{row.saison_annee || "—"}</TableCell>
                <TableCell><Badge className={getTypeColor(row.type_classement)}>{row.type_classement}</Badge></TableCell>
                <TableCell>{row.etape_numero || "—"}</TableCell>
                <TableCell className="text-right">{row.points}</TableCell>
                <TableCell>{new Date(row.created_at).toLocaleDateString("fr-FR")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => editState.handleEdit(row)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => editState.handleDelete(row)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filters.rawData && filters.rawData.length > pagination.pageSize && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={!pagination.hasPrevPage} onClick={pagination.prevPage}>Précédent</Button>
          <Button size="sm" variant="outline" disabled={!pagination.hasNextPage} onClick={pagination.nextPage}>Suivant</Button>
        </div>
      )}

      <PointsDialogs
        editDialogOpen={editState.editDialogOpen}
        setEditDialogOpen={editState.setEditDialogOpen}
        selectedEntry={editState.selectedEntry}
        newPoints={editState.newPoints}
        setNewPoints={editState.setNewPoints}
        deleteDialogOpen={editState.deleteDialogOpen}
        setDeleteDialogOpen={editState.setDeleteDialogOpen}
        entryToDelete={editState.entryToDelete}
      />
    </div>
  );
};

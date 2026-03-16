import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Save, X, Loader2, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CoursesTableProps {
  courses: any[];
  isLoading: boolean;
  onSave: (updates: Array<{ id: string; changes: any }>) => void;
  onDelete: (courseId: string, courseName: string) => void;
}

type SortField = 'nom' | 'date_debut' | 'date_fin' | 'categorie' | 'phase' | null;
type SortDirection = 'asc' | 'desc' | null;

export const CoursesTable = ({ courses, isLoading, onSave, onDelete }: CoursesTableProps) => {
  const [editedCourses, setEditedCourses] = useState<Map<string, any>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Fetch phases pour le dropdown
  const { data: phases } = useQuery({
    queryKey: ['phases-for-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('phases')
        .select('id, index_dans_saison, saisons(annee)')
        .order('date_debut', { ascending: false });
      return data || [];
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getPhaseLabel = (phaseId: string | null) => {
    if (!phaseId || !phases) return '';
    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return '';
    return `P${phase.index_dans_saison} - ${phase.saisons?.annee || ''}`;
  };

  const sortedCourses = useMemo(() => {
    if (!sortField || !sortDirection) return courses;

    return [...courses].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortField === 'phase') {
        aVal = getPhaseLabel(a.phase_id);
        bVal = getPhaseLabel(b.phase_id);
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? -1 : 1;
      if (bVal == null) return sortDirection === 'asc' ? 1 : -1;

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, 'fr', { sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Numeric/date comparison
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [courses, sortField, sortDirection, phases]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-4 w-4 ml-1" />;
    return <ArrowUp className="h-4 w-4 ml-1" />;
  };

  const handleCellEdit = (courseId: string, field: string, value: any) => {
    setEditedCourses((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(courseId) || {};
      newMap.set(courseId, { ...existing, [field]: value });
      return newMap;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updates = Array.from(editedCourses.entries()).map(([id, changes]) => ({
      id,
      changes,
    }));
    await onSave(updates);
    setEditedCourses(new Map());
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditedCourses(new Map());
  };

  const hasChanges = editedCourses.size > 0;

  const getCellValue = (course: any, field: string) => {
    return editedCourses.get(course.id)?.[field] ?? course[field];
  };

  if (isLoading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Chargement des courses...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {hasChanges && (
        <div className="flex items-center justify-between bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium">
            {editedCourses.size} course{editedCourses.size > 1 ? 's' : ''} modifiée{editedCourses.size > 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="w-[27%] cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('nom')}
              >
                <div className="flex items-center">
                  Nom
                  {getSortIcon('nom')}
                </div>
              </TableHead>
              <TableHead 
                className="w-[11%] cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('date_debut')}
              >
                <div className="flex items-center">
                  Date début
                  {getSortIcon('date_debut')}
                </div>
              </TableHead>
              <TableHead 
                className="w-[11%] cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('date_fin')}
              >
                <div className="flex items-center">
                  Date fin
                  {getSortIcon('date_fin')}
                </div>
              </TableHead>
              <TableHead 
                className="w-[14%] cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('categorie')}
              >
                <div className="flex items-center">
                  Catégorie
                  {getSortIcon('categorie')}
                </div>
              </TableHead>
              <TableHead 
                className="w-[17%] cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('phase')}
              >
                <div className="flex items-center">
                  Phase
                  {getSortIcon('phase')}
                </div>
              </TableHead>
              <TableHead className="w-[12%]">Statut</TableHead>
              <TableHead className="w-[8%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Aucune course trouvée
                </TableCell>
              </TableRow>
            ) : (
              sortedCourses.map((course) => {
                const isEdited = editedCourses.has(course.id);
                
                return (
                  <TableRow key={course.id} className={isEdited ? "bg-accent/50 dark:bg-accent/20" : ""}>
                    {/* Nom */}
                    <TableCell>
                      <Input
                        value={getCellValue(course, 'nom')}
                        onChange={(e) => handleCellEdit(course.id, 'nom', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>

                    {/* Date début */}
                    <TableCell>
                      <Input
                        type="date"
                        value={getCellValue(course, 'date_debut')}
                        onChange={(e) => handleCellEdit(course.id, 'date_debut', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>

                    {/* Date fin */}
                    <TableCell>
                      <Input
                        type="date"
                        value={getCellValue(course, 'date_fin')}
                        onChange={(e) => handleCellEdit(course.id, 'date_fin', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>

                    {/* Catégorie */}
                    <TableCell>
                      <Input
                        value={getCellValue(course, 'categorie') || ''}
                        onChange={(e) => handleCellEdit(course.id, 'categorie', e.target.value)}
                        className="h-8"
                        placeholder="Ex: WT, 1.1, 2.1"
                      />
                    </TableCell>

                    {/* Phase */}
                    <TableCell>
                      <Select
                        value={getCellValue(course, 'phase_id') || ''}
                        onValueChange={(value) => handleCellEdit(course.id, 'phase_id', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {phases?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              P{p.index_dans_saison} - {p.saisons?.annee}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Statut (read-only) */}
                    <TableCell>
                      <Badge
                        variant={
                          course.statut === 'completed' ? 'default' :
                          course.statut === 'in_progress' ? 'secondary' :
                          'outline'
                        }
                      >
                        {course.statut}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(course.id, course.nom)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {courses.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {courses.length} course{courses.length > 1 ? 's' : ''} affichée{courses.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

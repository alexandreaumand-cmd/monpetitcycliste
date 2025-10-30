import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Save, X, Loader2, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CoursesTableProps {
  courses: any[];
  isLoading: boolean;
  onSave: (updates: Array<{ id: string; changes: any }>) => void;
  onDelete: (courseId: string, courseName: string) => void;
}

export const CoursesTable = ({ courses, isLoading, onSave, onDelete }: CoursesTableProps) => {
  const [editedCourses, setEditedCourses] = useState<Map<string, any>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

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
              <TableHead className="w-[27%]">Nom</TableHead>
              <TableHead className="w-[11%]">Date début</TableHead>
              <TableHead className="w-[11%]">Date fin</TableHead>
              <TableHead className="w-[14%]">Catégorie</TableHead>
              <TableHead className="w-[17%]">Phase</TableHead>
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
              courses.map((course) => {
                const isEdited = editedCourses.has(course.id);
                
                return (
                  <TableRow key={course.id} className={isEdited ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}>
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

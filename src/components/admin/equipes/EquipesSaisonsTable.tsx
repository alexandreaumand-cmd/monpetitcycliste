import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Save, X, Loader2, Trash2 } from "lucide-react";

interface EquipesSaisonsTableProps {
  equipesSaisons: any[];
  isLoading: boolean;
  onSave: (updates: Array<{ id: string; changes: any }>) => void;
  onDelete: (id: string) => void;
}

export const EquipesSaisonsTable = ({ equipesSaisons, isLoading, onSave, onDelete }: EquipesSaisonsTableProps) => {
  const [editedEquipes, setEditedEquipes] = useState<Map<string, any>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  const handleCellEdit = (equipeId: string, field: string, value: any) => {
    setEditedEquipes((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(equipeId) || {};
      newMap.set(equipeId, { ...existing, [field]: value });
      return newMap;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updates = Array.from(editedEquipes.entries()).map(([id, changes]) => ({
      id,
      changes,
    }));
    await onSave(updates);
    setEditedEquipes(new Map());
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditedEquipes(new Map());
  };

  const hasChanges = editedEquipes.size > 0;

  const getCellValue = (equipe: any, field: string) => {
    return editedEquipes.get(equipe.id)?.[field] ?? equipe[field];
  };

  if (isLoading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Chargement des équipes...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {hasChanges && (
        <div className="flex items-center justify-between bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium">
            {editedEquipes.size} équipe{editedEquipes.size > 1 ? 's' : ''} modifiée{editedEquipes.size > 1 ? 's' : ''}
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
              <TableHead className="w-[15%]">Saison</TableHead>
              <TableHead className="w-[40%]">Nom</TableHead>
              <TableHead className="w-[15%]">Nb Coureurs</TableHead>
              <TableHead className="w-[15%]">Catégorie</TableHead>
              <TableHead className="w-[15%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipesSaisons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Aucune équipe trouvée
                </TableCell>
              </TableRow>
            ) : (
              equipesSaisons.map((equipe) => {
                const isEdited = editedEquipes.has(equipe.id);
                
                return (
                  <TableRow key={equipe.id} className={isEdited ? "bg-blue-50/50" : ""}>
                    {/* Saison (read-only) */}
                    <TableCell className="font-medium">
                      {equipe.saisons?.annee || 'N/A'}
                    </TableCell>

                    {/* Nom (éditable) */}
                    <TableCell>
                      <Input
                        type="text"
                        value={getCellValue(equipe, 'nom_affiche')}
                        onChange={(e) => handleCellEdit(equipe.id, 'nom_affiche', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>

                    {/* Nb Coureurs (read-only) */}
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {equipe.nb_coureurs || 0}
                      </div>
                    </TableCell>

                    {/* Catégorie (éditable) */}
                    <TableCell>
                      <Select
                        value={getCellValue(equipe, 'categorie') || 'none'}
                        onValueChange={(value) => handleCellEdit(equipe.id, 'categorie', value === 'none' ? null : value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Aucune" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucune</SelectItem>
                          <SelectItem value="WT">WorldTeam</SelectItem>
                          <SelectItem value="PT">ProTeam</SelectItem>
                          <SelectItem value="CT">Continental</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette équipe ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. L'équipe "{equipe.nom_affiche}" sera supprimée de la saison {equipe.saisons?.annee}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(equipe.id)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {equipesSaisons.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {equipesSaisons.length} équipe{equipesSaisons.length > 1 ? 's' : ''} affichée{equipesSaisons.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

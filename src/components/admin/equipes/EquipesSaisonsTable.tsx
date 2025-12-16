import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, Loader2, Trash2 } from "lucide-react";

interface EquipesSaisonsTableProps {
  equipesSaisons: any[];
  isLoading: boolean;
  onSave: (updates: Array<{ id: string; changes: any }>) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
}

export const EquipesSaisonsTable = ({ equipesSaisons, isLoading, onSave, onDelete, onBulkDelete }: EquipesSaisonsTableProps) => {
  const [editedEquipes, setEditedEquipes] = useState<Map<string, any>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    const updates = Array.from(editedEquipes.entries()).map(([id, changes]) => ({ id, changes }));
    await onSave(updates);
    setEditedEquipes(new Map());
    setIsSaving(false);
  };

  const getCellValue = (equipe: any, field: string) => {
    return editedEquipes.get(equipe.id)?.[field] ?? equipe[field];
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === equipesSaisons.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(equipesSaisons.map((e) => e.id)));
    }
  };

  const handleBulkDelete = () => {
    onBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
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
      {/* Barre de sélection / suppression en masse */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 p-4 rounded-lg border border-destructive/20">
          <p className="text-sm font-medium">{selectedIds.size} équipe(s) sélectionnée(s)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              <X className="h-4 w-4 mr-2" />Annuler
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />Supprimer ({selectedIds.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir supprimer {selectedIds.size} équipe(s) ? Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                    Supprimer {selectedIds.size} équipe(s)
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Barre de modifications */}
      {editedEquipes.size > 0 && selectedIds.size === 0 && (
        <div className="flex items-center justify-between bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium">{editedEquipes.size} équipe(s) modifiée(s)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditedEquipes(new Map())}>
              <X className="h-4 w-4 mr-2" />Annuler
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder
            </Button>
          </div>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={equipesSaisons.length > 0 && selectedIds.size === equipesSaisons.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[10%]">Saison</TableHead>
              <TableHead className="w-[28%]">Nom</TableHead>
              <TableHead className="w-[10%]">Trigramme</TableHead>
              <TableHead className="w-[10%]">Nb Coureurs</TableHead>
              <TableHead className="w-[18%]">Catégorie</TableHead>
              <TableHead className="w-[10%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipesSaisons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Aucune équipe trouvée</TableCell>
              </TableRow>
            ) : (
              equipesSaisons.map((equipe) => (
                <TableRow 
                  key={equipe.id} 
                  className={`${editedEquipes.has(equipe.id) ? "bg-muted/30" : ""} ${selectedIds.has(equipe.id) ? "bg-destructive/5" : ""}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(equipe.id)}
                      onCheckedChange={() => toggleSelection(equipe.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{equipe.saisons?.annee || 'N/A'}</TableCell>
                  <TableCell>
                    <Input value={getCellValue(equipe, 'nom_affiche')} onChange={(e) => handleCellEdit(equipe.id, 'nom_affiche', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={getCellValue(equipe, 'trigramme') || ''} onChange={(e) => handleCellEdit(equipe.id, 'trigramme', e.target.value.toUpperCase())} placeholder="Ex: UAD" className="h-8 max-w-[100px]" maxLength={5} />
                  </TableCell>
                  <TableCell><div className="text-sm text-muted-foreground">{equipe.nb_coureurs || 0}</div></TableCell>
                  <TableCell>
                    <Select value={getCellValue(equipe, 'categorie') || ''} onValueChange={(value) => handleCellEdit(equipe.id, 'categorie', value)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WT">WorldTour</SelectItem>
                        <SelectItem value="PT">ProTeam</SelectItem>
                        <SelectItem value="CT">Continental</SelectItem>
                        <SelectItem value="OT">Autres</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                          <AlertDialogDescription>Êtes-vous sûr de vouloir supprimer cette équipe ?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(equipe.id)}>Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
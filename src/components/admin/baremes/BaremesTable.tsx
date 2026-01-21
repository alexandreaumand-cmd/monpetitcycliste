import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, Loader2, Trash2 } from "lucide-react";

interface BaremesTableProps {
  baremes: any[];
  saisons: any[];
  isLoading: boolean;
  onSave: (updates: Array<{ id: string; changes: any }>) => void;
  onDelete: (baremeId: string, baremeInfo: string) => void;
  onDeleteBatch: (baremeIds: string[]) => void;
}

const categories = [
  "WT Monument",
  "WT GT",
  "Classiques WT Cat 1",
  "Classiques WT Cat 2",
  "Classiques WT Cat 3",
  "Tours WT Cat 1",
  "Tours WT Cat 2",
  "Tours WT Cat 3",
  "1.1",
  "1.pro",
  "2.1",
  "2.pro",
  "CN_ITT Cat 1",
  "CN_ITT Cat 2",
  "CN_ITT Cat 3",
  "CN_ITT Cat 4",
  "CN_RR Cat 1",
  "CN_RR Cat 2",
  "CN_RR Cat 3",
  "CN_RR Cat 4",
  "EC ITT",
  "EC RR",
  "WC ITT",
  "WC RR",
];

const typeClassements = [
  { value: "General", label: "Général" },
  { value: "Etape", label: "Étape" },
  { value: "Points", label: "Points" },
  { value: "Montagne", label: "Montagne" },
  { value: "Jeune", label: "Jeune" },
  { value: "Combatif", label: "Combativité" },
  { value: "Porteur Leader", label: "🟡 Porteur Jaune" },
  { value: "Porteur Vert", label: "🟢 Porteur Vert" },
  { value: "Porteur Montagne", label: "🔴 Porteur Pois" },
  { value: "Porteur Jeune", label: "⚪ Porteur Blanc" },
  { value: "Porteur Combattif", label: "🔵 Porteur Combativité" },
];

export const BaremesTable = ({ baremes, saisons, isLoading, onSave, onDelete, onDeleteBatch }: BaremesTableProps) => {
  const [editedBaremes, setEditedBaremes] = useState<Map<string, any>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBaremes, setSelectedBaremes] = useState<Set<string>>(new Set());

  const handleFieldChange = (baremeId: string, field: string, value: any) => {
    const bareme = baremes.find(b => b.id === baremeId);
    const currentEdits = editedBaremes.get(baremeId) || {};
    
    const newEdits = { ...currentEdits, [field]: value };
    const newEditedBaremes = new Map(editedBaremes);
    newEditedBaremes.set(baremeId, newEdits);
    setEditedBaremes(newEditedBaremes);
  };

  const hasChanges = (baremeId: string) => {
    return editedBaremes.has(baremeId);
  };

  const cancelEdit = (baremeId: string) => {
    const newEditedBaremes = new Map(editedBaremes);
    newEditedBaremes.delete(baremeId);
    setEditedBaremes(newEditedBaremes);
  };

  const handleSaveAll = async () => {
    if (editedBaremes.size === 0) return;

    setIsSaving(true);
    const updates = Array.from(editedBaremes.entries()).map(([id, changes]) => ({
      id,
      changes,
    }));

    await onSave(updates);
    setEditedBaremes(new Map());
    setIsSaving(false);
  };

  const getDisplayValue = (bareme: any, field: string) => {
    if (editedBaremes.has(bareme.id)) {
      const edits = editedBaremes.get(bareme.id);
      if (field in edits) {
        return edits[field];
      }
    }
    return bareme[field];
  };

  const toggleSelectAll = () => {
    if (selectedBaremes.size === baremes.length) {
      setSelectedBaremes(new Set());
    } else {
      setSelectedBaremes(new Set(baremes.map(b => b.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedBaremes);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedBaremes(newSet);
  };

  const handleDeleteSelected = () => {
    const count = selectedBaremes.size;
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${count} barème(s) ?\n\nCette action est irréversible.`)) {
      onDeleteBatch(Array.from(selectedBaremes));
      setSelectedBaremes(new Set());
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {editedBaremes.size > 0 && (
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => setEditedBaremes(new Map())}
            variant="outline"
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Annuler tout
          </Button>
          <Button onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Sauvegarder ({editedBaremes.size})
          </Button>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedBaremes.size === baremes.length && baremes.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[13%]">Saison</TableHead>
              <TableHead className="w-[18%]">Catégorie</TableHead>
              <TableHead className="w-[16%]">Type classement</TableHead>
              <TableHead className="w-[10%]">Place</TableHead>
              <TableHead className="w-[10%]">Points</TableHead>
              <TableHead className="w-[11%]">Type</TableHead>
              <TableHead className="w-[10%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {baremes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Aucun barème trouvé
                </TableCell>
              </TableRow>
            ) : (
              baremes.map((bareme) => {
                const isEdited = hasChanges(bareme.id);
                return (
                  <TableRow key={bareme.id} className={isEdited ? "bg-muted/50" : ""}>
                    {/* Checkbox */}
                    <TableCell>
                      <Checkbox
                        checked={selectedBaremes.has(bareme.id)}
                        onCheckedChange={() => toggleSelect(bareme.id)}
                      />
                    </TableCell>

                    {/* Saison */}
                    <TableCell>
                      <Select
                        value={getDisplayValue(bareme, 'saison_id')}
                        onValueChange={(value) => handleFieldChange(bareme.id, 'saison_id', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {saisons?.map((saison) => (
                            <SelectItem key={saison.id} value={saison.id}>
                              {saison.annee}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Catégorie */}
                    <TableCell>
                      <Select
                        value={getDisplayValue(bareme, 'categorie')}
                        onValueChange={(value) => handleFieldChange(bareme.id, 'categorie', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Type classement */}
                    <TableCell>
                      <Select
                        value={getDisplayValue(bareme, 'type_classement')}
                        onValueChange={(value) => handleFieldChange(bareme.id, 'type_classement', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {typeClassements.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Place */}
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={getDisplayValue(bareme, 'place')}
                        onChange={(e) => handleFieldChange(bareme.id, 'place', parseInt(e.target.value))}
                        className="h-8"
                      />
                    </TableCell>

                    {/* Points */}
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={getDisplayValue(bareme, 'points')}
                        onChange={(e) => handleFieldChange(bareme.id, 'points', parseInt(e.target.value))}
                        className="h-8"
                      />
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {bareme.type || '-'}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex gap-1">
                        {isEdited && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelEdit(bareme.id)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(bareme.id, `${bareme.categorie} - ${bareme.type_classement} - Place ${bareme.place}`)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {selectedBaremes.size > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            variant="destructive"
            size="lg"
            onClick={handleDeleteSelected}
            className="shadow-lg"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer la sélection ({selectedBaremes.size})
          </Button>
        </div>
      )}
    </div>
  );
};

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Save, X, Loader2, Pencil } from "lucide-react";
import { EquipeSelect } from "@/components/shared/EquipeSelect";

interface CoureursTableProps {
  coureurs: any[];
  isLoading: boolean;
  onSave: (updates: Array<{ id: string; changes: any }>) => void;
  preloadedEquipes?: any[];
}

export const CoureursTable = ({ coureurs, isLoading, onSave, preloadedEquipes }: CoureursTableProps) => {
  const [editedCoureurs, setEditedCoureurs] = useState<Map<string, any>>(new Map());
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCellEdit = (coureurSaisonId: string, field: string, value: any) => {
    setEditedCoureurs((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(coureurSaisonId) || {};
      newMap.set(coureurSaisonId, { ...existing, [field]: value });
      return newMap;
    });
  };

  const handleSave = async (coureurId: string) => {
    setIsSaving(true);
    const changes = editedCoureurs.get(coureurId);
    if (changes) {
      await onSave([{ id: coureurId, changes }]);
    }
    setEditedCoureurs(new Map());
    setEditingRowId(null);
    setIsSaving(false);
  };

  const handleCancel = (coureurId: string) => {
    const newMap = new Map(editedCoureurs);
    newMap.delete(coureurId);
    setEditedCoureurs(newMap);
    setEditingRowId(null);
  };

  const handleEdit = (coureurId: string) => {
    setEditingRowId(coureurId);
  };

  const getCellValue = (coureur: any, field: string) => {
    return editedCoureurs.get(coureur.id)?.[field] ?? coureur[field];
  };

  const isEditing = (coureurId: string) => editingRowId === coureurId;

  if (isLoading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Chargement des coureurs...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[8%]">ID</TableHead>
              <TableHead className="w-[8%]">Saison</TableHead>
              <TableHead className="w-[15%]">Coureur</TableHead>
              <TableHead className="w-[22%]">Équipe</TableHead>
              <TableHead className="w-[8%]">Cote</TableHead>
              <TableHead className="w-[12%]">Created At</TableHead>
              <TableHead className="w-[12%]">Updated At</TableHead>
              <TableHead className="w-[15%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coureurs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Aucun coureur trouvé
                </TableCell>
              </TableRow>
            ) : (
              coureurs.map((coureur) => {
                const editing = isEditing(coureur.id);
                
                return (
                  <TableRow key={coureur.id} className={editing ? "bg-blue-50/50" : ""}>
                    {/* ID (uuid, non modifiable) */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {coureur.id.substring(0, 8)}...
                    </TableCell>

                    {/* Saison (affiche l'année) */}
                    <TableCell className="text-sm font-medium">
                      {coureur.saison_annee || 'N/A'}
                    </TableCell>

                    {/* Coureur */}
                    <TableCell>
                      {editing ? (
                        <>
                          <Input
                            type="text"
                            value={getCellValue(coureur, 'coureur_id')}
                            onChange={(e) => handleCellEdit(coureur.id, 'coureur_id', e.target.value)}
                            className="h-8 w-full font-mono text-xs"
                            placeholder="coureur_id"
                          />
                          <span className="text-xs text-muted-foreground mt-1 block">
                            {coureur.coureur_nom || 'Nom inconnu'}
                          </span>
                        </>
                      ) : (
                        <div className="text-sm">
                          {coureur.coureur_nom || 'Nom inconnu'}
                        </div>
                      )}
                    </TableCell>

                    {/* Équipe ID (uuid, modifiable) */}
                    <TableCell>
                      {editing ? (
                        <>
                          <EquipeSelect
                            saisonId={coureur.saison_id}
                            value={getCellValue(coureur, 'equipe_id')}
                            onChange={(equipeId) => handleCellEdit(coureur.id, 'equipe_id', equipeId)}
                            placeholder={coureur.equipe_nom || 'Sélectionner une équipe'}
                            preloadedEquipes={preloadedEquipes}
                          />
                          <span className="text-xs text-muted-foreground mt-1 block">
                            Actuel: {coureur.equipe_nom || 'N/A'}
                          </span>
                        </>
                      ) : (
                        <div className="text-sm">
                          {coureur.equipe_nom || 'Aucune équipe'}
                        </div>
                      )}
                    </TableCell>

                    {/* Prix initial (numeric, modifiable) */}
                    <TableCell>
                      {editing ? (
                        <Input
                          type="number"
                          min={10}
                          max={370}
                          value={getCellValue(coureur, 'prix_initial')}
                          onChange={(e) => handleCellEdit(coureur.id, 'prix_initial', parseFloat(e.target.value))}
                          className="h-8 w-24"
                        />
                      ) : (
                        <div className="font-medium">{coureur.prix_initial}</div>
                      )}
                    </TableCell>

                    {/* Created At (timestamp, non modifiable) */}
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(coureur.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>

                    {/* Updated At (timestamp, non modifiable) */}
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(coureur.updated_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      {editing ? (
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleCancel(coureur.id)}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleSave(coureur.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEdit(coureur.id)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Modifier
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {coureurs.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {coureurs.length} coureur{coureurs.length > 1 ? 's' : ''} affiché{coureurs.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

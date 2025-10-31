import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Save, X, Loader2 } from "lucide-react";
import { EquipeSelect } from "@/components/shared/EquipeSelect";

interface CoureursTableProps {
  coureurs: any[];
  isLoading: boolean;
  onSave: (updates: Array<{ id: string; changes: any }>) => void;
  preloadedEquipes?: any[];
}

export const CoureursTable = ({ coureurs, isLoading, onSave, preloadedEquipes }: CoureursTableProps) => {
  const [editedCoureurs, setEditedCoureurs] = useState<Map<string, any>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  const handleCellEdit = (coureurSaisonId: string, field: string, value: any) => {
    setEditedCoureurs((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(coureurSaisonId) || {};
      newMap.set(coureurSaisonId, { ...existing, [field]: value });
      return newMap;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updates = Array.from(editedCoureurs.entries()).map(([id, changes]) => ({
      id,
      changes,
    }));
    await onSave(updates);
    setEditedCoureurs(new Map());
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditedCoureurs(new Map());
  };

  const hasChanges = editedCoureurs.size > 0;

  const getCellValue = (coureur: any, field: string) => {
    return editedCoureurs.get(coureur.id)?.[field] ?? coureur[field];
  };

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
      {hasChanges && (
        <div className="flex items-center justify-between bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium">
            {editedCoureurs.size} coureur{editedCoureurs.size > 1 ? 's' : ''} modifié{editedCoureurs.size > 1 ? 's' : ''}
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
              <TableHead className="w-[10%]">ID</TableHead>
              <TableHead className="w-[12%]">Saison ID</TableHead>
              <TableHead className="w-[15%]">Coureur</TableHead>
              <TableHead className="w-[20%]">Équipe</TableHead>
              <TableHead className="w-[10%]">Cote</TableHead>
              <TableHead className="w-[12%]">Created At</TableHead>
              <TableHead className="w-[12%]">Updated At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coureurs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Aucun coureur trouvé
                </TableCell>
              </TableRow>
            ) : (
              coureurs.map((coureur) => {
                const isEdited = editedCoureurs.has(coureur.id);
                
                return (
                  <TableRow key={coureur.id} className={isEdited ? "bg-blue-50/50" : ""}>
                    {/* ID (uuid, non modifiable) */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {coureur.id.substring(0, 8)}...
                    </TableCell>

                    {/* Saison ID (uuid, non modifiable) */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {coureur.saison_id.substring(0, 8)}...
                    </TableCell>

                    {/* Coureur ID (text, modifiable) */}
                    <TableCell>
                      <Input
                        type="text"
                        value={getCellValue(coureur, 'coureur_id')}
                        onChange={(e) => handleCellEdit(coureur.id, 'coureur_id', e.target.value)}
                        className="h-8 w-full font-mono text-xs"
                        placeholder="coureur_id"
                      />
                      <span className="text-xs text-muted-foreground mt-1 block">
                        {coureur.coureurs?.nom || 'Nom inconnu'}
                      </span>
                    </TableCell>

                    {/* Équipe ID (uuid, modifiable) */}
                    <TableCell>
                      <EquipeSelect
                        saisonId={coureur.saison_id}
                        value={getCellValue(coureur, 'equipe_id')}
                        onChange={(equipeId) => handleCellEdit(coureur.id, 'equipe_id', equipeId)}
                        placeholder={coureur.equipes_saisons?.nom_affiche || 'Sélectionner une équipe'}
                        preloadedEquipes={preloadedEquipes}
                      />
                      {coureur.equipes_saisons?.equipes?.code_court && (
                        <span className="text-xs text-muted-foreground mt-1 block">
                          Actuel: {coureur.equipes_saisons.nom_affiche} ({coureur.equipes_saisons.equipes.code_court})
                        </span>
                      )}
                    </TableCell>

                    {/* Prix initial (numeric, modifiable) */}
                    <TableCell>
                      <Input
                        type="number"
                        min={10}
                        max={370}
                        value={getCellValue(coureur, 'prix_initial')}
                        onChange={(e) => handleCellEdit(coureur.id, 'prix_initial', parseFloat(e.target.value))}
                        className="h-8 w-24"
                      />
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

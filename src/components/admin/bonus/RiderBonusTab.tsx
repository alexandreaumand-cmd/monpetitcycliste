import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2, Trophy, Star, Timer, Pencil, RefreshCw } from "lucide-react";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";

interface RiderBonusTabProps {
  phaseId: string;
  saisonId: string;
}

const BONUS_TYPES = [
  { value: 'first_win', label: 'First Win', icon: Trophy, description: 'Première victoire du coureur' },
  { value: 'coureur_bonuse', label: 'Coureur Bonusé (+25%)', icon: Star, description: 'Bonus sur un coureur spécifique' },
  { value: 'itt', label: 'ITT', icon: Timer, description: 'Contre-la-montre individuel' },
];

export const RiderBonusTab = ({ phaseId, saisonId }: RiderBonusTabProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bonusToDelete, setBonusToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bonusToEdit, setBonusToEdit] = useState<any>(null);
  const [editPoints, setEditPoints] = useState("");
  const [editCommentaire, setEditCommentaire] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Recalculate state
  const [recalculateDialogOpen, setRecalculateDialogOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Form state
  const [bonusType, setBonusType] = useState<string>("");
  const [selectedCoureur, setSelectedCoureur] = useState<any>(null);
  const [points, setPoints] = useState<string>("");
  const [commentaire, setCommentaire] = useState("");

  // Fetch existing rider bonuses
  const { data: bonuses, isLoading } = useQuery({
    queryKey: ["rider-bonuses", phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_points")
        .select(`
          id,
          bonus_type,
          points,
          commentaire,
          coureur_id,
          manager_id,
          created_at,
          coureur:coureurs!bonus_points_coureur_id_fkey(id, nom),
          manager:managers!bonus_points_manager_id_fkey(id, nom)
        `)
        .eq("phase_id", phaseId)
        .in("bonus_type", ['first_win', 'coureur_bonuse', 'itt'])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with team info
      const enriched = await Promise.all(
        (data || []).map(async (bonus) => {
          if (!bonus.coureur_id) return bonus;

          const { data: seasonData } = await supabase
            .from("coureurs_saisons")
            .select(`
              equipes_saisons!coureurs_saisons_equipe_id_fkey(nom_affiche, trigramme)
            `)
            .eq("coureur_id", bonus.coureur_id)
            .eq("saison_id", saisonId)
            .maybeSingle();

          return {
            ...bonus,
            equipe: (seasonData?.equipes_saisons as any)?.trigramme || 
                    (seasonData?.equipes_saisons as any)?.nom_affiche || 'N/A'
          };
        })
      );

      return enriched;
    },
    enabled: !!phaseId,
  });

  const resetForm = () => {
    setBonusType("");
    setSelectedCoureur(null);
    setPoints("");
    setCommentaire("");
  };

  const handleSubmit = async () => {
    if (!bonusType || !selectedCoureur || !points) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (bonusType === 'coureur_bonuse' && !selectedCoureur.manager_id) {
      toast.error("Ce coureur n'est associé à aucun manager");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: managerData } = await supabase
        .from("managers")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!managerData?.id) {
        throw new Error("Aucun profil manager trouvé");
      }

      const isMultiManagerBonus = bonusType === 'first_win' || bonusType === 'itt';

      if (isMultiManagerBonus) {
        const { data: rostersData, error: rostersError } = await supabase
          .from("rosters")
          .select("manager_id")
          .eq("phase_id", phaseId)
          .eq("coureur_id", selectedCoureur.id);

        if (rostersError) throw rostersError;

        if (!rostersData || rostersData.length === 0) {
          toast.error("Ce coureur n'est possédé par aucun manager");
          setIsSubmitting(false);
          return;
        }

        const bonusInserts = rostersData.map(roster => ({
          phase_id: phaseId,
          bonus_type: bonusType,
          coureur_id: selectedCoureur.id,
          manager_id: roster.manager_id,
          points: parseInt(points),
          commentaire: commentaire || null,
          created_by: managerData.id,
        }));

        const { error } = await supabase.from("bonus_points").insert(bonusInserts);
        if (error) throw error;

        toast.success(`Bonus attribué à ${rostersData.length} manager(s)`);
      } else {
        const { error } = await supabase.from("bonus_points").insert([{
          phase_id: phaseId,
          bonus_type: bonusType,
          coureur_id: selectedCoureur.id,
          manager_id: selectedCoureur.manager_id,
          points: parseInt(points),
          commentaire: commentaire || null,
          created_by: managerData.id,
        }]);

        if (error) throw error;
        toast.success("Bonus enregistré");
      }

      queryClient.invalidateQueries({ queryKey: ["rider-bonuses", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["bonus-points-overview", phaseId] });
      resetForm();
      setDialogOpen(false);
    } catch (error: any) {
      console.error("Error saving bonus:", error);
      toast.error(error.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!bonusToDelete) return;

    try {
      const { error } = await supabase
        .from("bonus_points")
        .delete()
        .eq("id", bonusToDelete);

      if (error) throw error;

      toast.success("Bonus supprimé");
      queryClient.invalidateQueries({ queryKey: ["rider-bonuses", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["bonus-points-overview", phaseId] });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression");
    } finally {
      setBonusToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const openEditDialog = (bonus: any) => {
    setBonusToEdit(bonus);
    setEditPoints(String(bonus.points));
    setEditCommentaire(bonus.commentaire || "");
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!bonusToEdit || !editPoints) return;

    setIsEditing(true);
    try {
      const { error } = await supabase
        .from("bonus_points")
        .update({
          points: parseFloat(editPoints),
          commentaire: editCommentaire || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bonusToEdit.id);

      if (error) throw error;

      toast.success("Bonus modifié");
      queryClient.invalidateQueries({ queryKey: ["rider-bonuses", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["bonus-points-overview", phaseId] });
      setEditDialogOpen(false);
      setBonusToEdit(null);
    } catch (error: any) {
      console.error("Error editing bonus:", error);
      toast.error(error.message || "Erreur lors de la modification");
    } finally {
      setIsEditing(false);
    }
  };

  const handleRecalculate = async () => {
    if (!phaseId) {
      toast.error("Sélectionne une phase précise (pas « Toutes les phases ») pour lancer le recalcul.");
      return;
    }

    setIsRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('recalculate-rider-bonuses', {
        body: { phase_id: phaseId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        const variation = data.variation >= 0 ? `+${data.variation.toFixed(2)}` : data.variation.toFixed(2);
        toast.success(`${data.recalculated} bonus recalculés (${data.total_before.toFixed(2)} → ${data.total_after.toFixed(2)}, ${variation} pts)`);
        queryClient.invalidateQueries({ queryKey: ["rider-bonuses", phaseId] });
        queryClient.invalidateQueries({ queryKey: ["bonus-points-overview", phaseId] });
      } else {
        toast.info(data?.message || "Aucun bonus à recalculer");
      }
    } catch (error: any) {
      console.error("Error recalculating bonuses:", error);
      toast.error(error.message || "Erreur lors du recalcul");
    } finally {
      setIsRecalculating(false);
      setRecalculateDialogOpen(false);
    }
  };

  const getBonusIcon = (type: string) => {
    const config = BONUS_TYPES.find(b => b.value === type);
    const Icon = config?.icon || Trophy;
    return <Icon className="h-4 w-4" />;
  };

  const getBonusLabel = (type: string) => {
    return BONUS_TYPES.find(b => b.value === type)?.label || type;
  };

  return (
    <div className="space-y-6">
      {/* Recalculate Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Recalcul des bonus coureur (+25%)
          </CardTitle>
          <CardDescription>
            Recalcule tous les bonus « Coureur Bonusé » pour cette phase en se basant sur les points actuels du ledger.
            Les anciens bonus sont supprimés et régénérés avec les montants corrects (25% des points).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            onClick={() => setRecalculateDialogOpen(true)}
            disabled={isRecalculating || !phaseId}
          >
            {isRecalculating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <RefreshCw className="h-4 w-4 mr-2" />
            Recalculer tous les bonus coureur
          </Button>
          {!phaseId && (
            <p className="text-sm text-muted-foreground">
              Choisis d’abord une phase spécifique pour activer le recalcul.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Button */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un bonus coureur
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau Bonus Coureur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Type de bonus *</Label>
                <Select value={bonusType} onValueChange={setBonusType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BONUS_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bonusType && (
                  <p className="text-xs text-muted-foreground">
                    {BONUS_TYPES.find(b => b.value === bonusType)?.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Coureur *</Label>
                <CoureursCombobox
                  phaseId={phaseId}
                  value={selectedCoureur?.id}
                  onSelect={setSelectedCoureur}
                  showManager={bonusType === 'coureur_bonuse'}
                  context="super-admin"
                />
                {selectedCoureur && (
                  <p className="text-xs text-muted-foreground">
                    {selectedCoureur.nom} ({selectedCoureur.equipe})
                    {bonusType === 'coureur_bonuse' && selectedCoureur.manager_nom && (
                      <span> • Manager: {selectedCoureur.manager_nom}</span>
                    )}
                    {(bonusType === 'first_win' || bonusType === 'itt') && (
                      <span className="text-primary"> • Attribué à tous les managers possesseurs</span>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Points *</Label>
                <Input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="50"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Commentaire (optionnel)</Label>
                <Textarea
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Première victoire de la saison..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bonuses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bonus Coureur attribués</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : bonuses?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun bonus coureur attribué pour cette phase
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Coureur</TableHead>
                    <TableHead>Équipe</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead>Commentaire</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonuses?.map((bonus: any) => (
                    <TableRow key={bonus.id}>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {getBonusIcon(bonus.bonus_type)}
                          {getBonusLabel(bonus.bonus_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {bonus.coureur?.nom || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{bonus.equipe || '-'}</Badge>
                      </TableCell>
                      <TableCell>{bonus.manager?.nom || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge>{bonus.points > 0 ? `+${bonus.points}` : bonus.points}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {bonus.commentaire || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(bonus)}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBonusToDelete(bonus.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le bonus</DialogTitle>
          </DialogHeader>
          {bonusToEdit && (
            <div className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{bonusToEdit.coureur?.nom}</span>
                {" — "}
                {getBonusLabel(bonusToEdit.bonus_type)}
                {bonusToEdit.manager?.nom && ` (${bonusToEdit.manager.nom})`}
              </div>

              <div className="space-y-2">
                <Label>Points</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPoints}
                  onChange={(e) => setEditPoints(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Commentaire</Label>
                <Textarea
                  value={editCommentaire}
                  onChange={(e) => setEditCommentaire(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleEdit} disabled={isEditing}>
                  {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Sauvegarder
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce bonus ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recalculate Confirmation */}
      <AlertDialog open={recalculateDialogOpen} onOpenChange={setRecalculateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recalculer les bonus coureur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va <strong>supprimer</strong> tous les bonus « Coureur Bonusé (+25%) » existants pour cette phase
              et les <strong>régénérer</strong> à partir des points actuels du ledger.
              <br /><br />
              Les bonus de type First Win et ITT ne sont pas affectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecalculate} disabled={isRecalculating}>
              {isRecalculating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Recalculer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

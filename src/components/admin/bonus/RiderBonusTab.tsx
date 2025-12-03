import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2, Trophy, Star, Timer } from "lucide-react";
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

    // For coureur_bonuse, need manager
    if (bonusType === 'coureur_bonuse' && !selectedCoureur.manager_id) {
      toast.error("Ce coureur n'est associé à aucun manager");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current user's manager_id
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
        // Get all managers owning this rider
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

        // Create bonus for each manager
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
        // Single manager bonus (coureur_bonuse)
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
                />
                {selectedCoureur && (
                  <p className="text-xs text-muted-foreground">
                    {selectedCoureur.nom} ({selectedCoureur.equipe})
                    {bonusType === 'coureur_bonuse' && selectedCoureur.manager_nom && (
                      <span> • Manager: {selectedCoureur.manager_nom}</span>
                    )}
                    {(bonusType === 'first_win' || bonusType === 'itt') && (
                      <span className="text-blue-600"> • Attribué à tous les managers possesseurs</span>
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
                    <TableHead className="text-right">Action</TableHead>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
};

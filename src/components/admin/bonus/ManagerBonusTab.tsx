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
import { Plus, Trash2, Loader2, Users, Target, Calculator } from "lucide-react";

interface ManagerBonusTabProps {
  phaseId: string;
  leagueId?: string;
  saisonId: string;
}

const BONUS_TYPES = [
  { value: 'ttt', label: 'TTT', icon: Users, description: 'Contre-la-montre par équipes' },
  { value: 'scoreurs', label: 'Scoreurs', icon: Target, description: 'Bonus scoreurs' },
];

export const ManagerBonusTab = ({ phaseId, leagueId, saisonId }: ManagerBonusTabProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bonusToDelete, setBonusToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Form state
  const [bonusType, setBonusType] = useState<string>("");
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(leagueId || "");
  const [points, setPoints] = useState<string>("");
  const [commentaire, setCommentaire] = useState("");

  const handleAutoCalculate = async () => {
    if (!phaseId) {
      toast.error("Veuillez sélectionner une phase");
      return;
    }

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('compute-bonus-scoreurs', {
        body: { phase_id: phaseId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || "Bonus scoreurs calculés");
        queryClient.invalidateQueries({ queryKey: ["manager-bonuses", phaseId] });
        queryClient.invalidateQueries({ queryKey: ["manager-bonus-points-overview", phaseId] });
      } else {
        toast.info(data?.message || "Aucun bonus à attribuer");
      }
    } catch (error: any) {
      console.error("Error computing bonus:", error);
      toast.error(error.message || "Erreur lors du calcul");
    } finally {
      setIsCalculating(false);
    }
  };

  // Fetch leagues for selection
  const { data: leagues } = useQuery({
    queryKey: ["all-leagues-for-bonus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leagues")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch managers from league or all managers
  const { data: managers } = useQuery({
    queryKey: ["managers-for-bonus", selectedLeagueId],
    queryFn: async () => {
      if (selectedLeagueId) {
        // Get managers from league members
        const { data: members, error } = await supabase
          .from("league_members")
          .select(`
            user_id,
            managers!inner(id, nom)
          `)
          .eq("league_id", selectedLeagueId);
        
        if (error) throw error;
        return members?.map(m => (m.managers as any)) || [];
      } else {
        // Get all managers
        const { data, error } = await supabase
          .from("managers")
          .select("id, nom")
          .order("nom");
        if (error) throw error;
        return data || [];
      }
    },
  });

  // Fetch existing manager bonuses
  const { data: bonuses, isLoading } = useQuery({
    queryKey: ["manager-bonuses", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("manager_bonus_points")
        .select(`
          id,
          manager_id,
          league_id,
          bonus_ttt,
          bonus_scoreurs,
          bonus_coureurs,
          bonus_first_win,
          bonus_itt,
          commentaire,
          created_at,
          manager:managers!manager_bonus_points_manager_id_fkey(id, nom),
          league:leagues!fk_manager_bonus_points_league(id, name)
        `)
        .eq("phase_id", phaseId);

      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!phaseId,
  });

  const resetForm = () => {
    setBonusType("");
    setSelectedManagerId("");
    setSelectedLeagueId(leagueId || "");
    setPoints("");
    setCommentaire("");
  };

  const handleSubmit = async () => {
    if (!bonusType || !selectedManagerId || !points || !selectedLeagueId) {
      toast.error("Veuillez remplir tous les champs obligatoires");
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

      // Check if entry already exists for this manager/phase/league
      const { data: existing } = await supabase
        .from("manager_bonus_points")
        .select("id")
        .eq("phase_id", phaseId)
        .eq("manager_id", selectedManagerId)
        .eq("league_id", selectedLeagueId)
        .maybeSingle();

      const bonusField = bonusType === 'ttt' ? 'bonus_ttt' : 'bonus_scoreurs';
      const pointsValue = parseInt(points);

      if (existing) {
        // Update existing entry
        const { error } = await supabase
          .from("manager_bonus_points")
          .update({
            [bonusField]: pointsValue,
            commentaire: commentaire || null,
          })
          .eq("id", existing.id);

        if (error) throw error;
        toast.success("Bonus mis à jour");
      } else {
        // Create new entry
        const { error } = await supabase
          .from("manager_bonus_points")
          .insert([{
            phase_id: phaseId,
            manager_id: selectedManagerId,
            league_id: selectedLeagueId,
            [bonusField]: pointsValue,
            commentaire: commentaire || null,
            created_by: managerData.id,
          }]);

        if (error) throw error;
        toast.success("Bonus enregistré");
      }

      queryClient.invalidateQueries({ queryKey: ["manager-bonuses", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["manager-bonus-points-overview", phaseId] });
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
        .from("manager_bonus_points")
        .delete()
        .eq("id", bonusToDelete);

      if (error) throw error;

      toast.success("Bonus supprimé");
      queryClient.invalidateQueries({ queryKey: ["manager-bonuses", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["manager-bonus-points-overview", phaseId] });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression");
    } finally {
      setBonusToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const getTotalBonus = (bonus: any) => {
    return (bonus.bonus_ttt || 0) + (bonus.bonus_scoreurs || 0) + 
           (bonus.bonus_coureurs || 0) + (bonus.bonus_first_win || 0) + 
           (bonus.bonus_itt || 0);
  };

  return (
    <div className="space-y-6">
      {/* Auto-calculate Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Calcul automatique du bonus Scoreurs
          </CardTitle>
          <CardDescription>
            Attribue 200 pts au(x) manager(s) avec le plus de coureurs ayant marqué des points dans la phase.
            En cas d'égalité, tous les managers ex-aequo reçoivent le bonus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleAutoCalculate} 
            disabled={isCalculating || !phaseId}
            variant="secondary"
          >
            {isCalculating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            Calculer le bonus Scoreurs
          </Button>
        </CardContent>
      </Card>

      {/* Add Button */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un bonus manager
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau Bonus Manager</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Ligue *</Label>
                <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une ligue" />
                  </SelectTrigger>
                  <SelectContent>
                    {leagues?.map((league) => (
                      <SelectItem key={league.id} value={league.id}>
                        {league.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Manager *</Label>
                <Select 
                  value={selectedManagerId} 
                  onValueChange={setSelectedManagerId}
                  disabled={!selectedLeagueId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers?.map((manager: any) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  placeholder="Notes..."
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
          <CardTitle>Bonus Manager attribués</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : bonuses?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun bonus manager attribué pour cette phase
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manager</TableHead>
                    <TableHead>Ligue</TableHead>
                    <TableHead className="text-center">TTT</TableHead>
                    <TableHead className="text-center">Scoreurs</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Commentaire</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonuses?.map((bonus: any) => (
                    <TableRow key={bonus.id}>
                      <TableCell className="font-medium">
                        {bonus.manager?.nom || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{bonus.league?.name || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {bonus.bonus_ttt > 0 && (
                          <Badge variant="secondary">{bonus.bonus_ttt}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {bonus.bonus_scoreurs > 0 && (
                          <Badge variant="secondary">{bonus.bonus_scoreurs}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge>{getTotalBonus(bonus)}</Badge>
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

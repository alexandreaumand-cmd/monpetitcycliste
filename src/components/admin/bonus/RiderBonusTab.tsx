import { useState, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, Loader2, Trophy, Star, Timer, Pencil, RefreshCw, Check, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";
import { cn } from "@/lib/utils";

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
  const [recalcCourseId, setRecalcCourseId] = useState<string>("all");
  const [recalcCoursePopoverOpen, setRecalcCoursePopoverOpen] = useState(false);
  const [recalcEtape, setRecalcEtape] = useState<string>("all"); // 'all' | 'final' | numéro
  const [recalcCoureur, setRecalcCoureur] = useState<any>(null);

  // Table filters and sort
  const [filterCoureur, setFilterCoureur] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterPointsMin, setFilterPointsMin] = useState("");
  const [filterPointsMax, setFilterPointsMax] = useState("");
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterEtape, setFilterEtape] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string | null>("points");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const resetFiltersAndSort = () => {
    setFilterCoureur("");
    setFilterCourse("");
    setFilterPointsMin("");
    setFilterPointsMax("");
    setFilterPhase("all");
    setFilterEtape("all");
    setSortColumn("points");
    setSortDirection("desc");
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };


  // Form state
  const [bonusType, setBonusType] = useState<string>("");
  const [selectedCoureur, setSelectedCoureur] = useState<any>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [coursePopoverOpen, setCoursePopoverOpen] = useState(false);
  const [points, setPoints] = useState<string>("");
  const [commentaire, setCommentaire] = useState("");

  // Edit course state
  const [editCourseId, setEditCourseId] = useState<string>("");
  const [editCoursePopoverOpen, setEditCoursePopoverOpen] = useState(false);

  // Propriétaires du coureur sélectionné sur la phase (avertissement pré-saisie)
  const { data: selectedRiderOwners } = useQuery({
    queryKey: ["rider-bonus-owners", phaseId, selectedCoureur?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rosters")
        .select("manager_id")
        .eq("phase_id", phaseId)
        .eq("coureur_id", selectedCoureur.id);
      if (error) throw error;
      return (data || []).filter((r: any) => r.manager_id);
    },
    enabled: !!phaseId && !!selectedCoureur?.id,
  });

  const courseRequired = bonusType === 'first_win' || bonusType === 'itt';

  // Fetch courses for the selected season
  const { data: courses = [] } = useQuery({
    queryKey: ["bonus-courses", saisonId],
    queryFn: async () => {
      const { data: phasesData } = await supabase
        .from("phases")
        .select("id")
        .eq("saison_id", saisonId);
      const phaseIds = (phasesData || []).map((p) => p.id);
      if (phaseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, date_debut, categorie")
        .in("phase_id", phaseIds)
        .order("date_debut", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!saisonId,
  });

  const coursesMap = new Map(courses.map((c: any) => [c.id, c]));

  // Étapes disponibles (depuis le ledger) pour la course choisie dans le recalcul
  const { data: recalcEtapes = [] } = useQuery({
    queryKey: ["recalc-etapes", phaseId, recalcCourseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_ledger")
        .select("etape_numero")
        .eq("phase_id", phaseId)
        .eq("course_id", recalcCourseId)
        .not("etape_numero", "is", null);
      if (error) throw error;
      const set = new Set<number>((data || []).map((r: any) => Number(r.etape_numero)));
      return [...set].sort((a, b) => a - b);
    },
    enabled: !!phaseId && recalcCourseId !== "all",
  });


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
          course_id,
          league_id,
          created_at,
          coureur:coureurs!bonus_points_coureur_id_fkey(id, nom),
          manager:managers!bonus_points_manager_id_fkey(id, nom)
        `)
        .eq("phase_id", phaseId)
        .in("bonus_type", ['first_win', 'coureur_bonuse', 'itt'])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Resolve league names via bonus_points.league_id directly
      const leagueIds = [...new Set((data || []).map((b: any) => b.league_id).filter(Boolean))] as string[];
      const leaguesMap = new Map<string, string>();
      if (leagueIds.length > 0) {
        const { data: leaguesData } = await supabase
          .from("leagues")
          .select("id, name")
          .in("id", leagueIds);
        (leaguesData || []).forEach((l: any) => leaguesMap.set(l.id, l.name));
      }

      // Enrich with team info and league name
      const enriched = await Promise.all(
        (data || []).map(async (bonus: any) => {
          let equipe = 'N/A';
          if (bonus.coureur_id) {
            const { data: seasonData } = await supabase
              .from("coureurs_saisons")
              .select(`
                equipes_saisons!coureurs_saisons_equipe_id_fkey(nom_affiche, trigramme)
              `)
              .eq("coureur_id", bonus.coureur_id)
              .eq("saison_id", saisonId)
              .maybeSingle();

            equipe = (seasonData?.equipes_saisons as any)?.trigramme || 
                    (seasonData?.equipes_saisons as any)?.nom_affiche || 'N/A';
          }

          return {
            ...bonus,
            equipe,
            league_name: bonus.league_id ? (leaguesMap.get(bonus.league_id) || '—') : '—'
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
    setSelectedCourseId("");
    setPoints("");
    setCommentaire("");
  };

  const handleSubmit = async () => {
    if (!bonusType || !selectedCoureur || !points) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (courseRequired && !selectedCourseId) {
      toast.error("La course est obligatoire pour ce type de bonus");
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
      const courseIdToSave = courseRequired ? selectedCourseId : null;

      if (isMultiManagerBonus) {
        const { data: rostersData, error: rostersError } = await supabase
          .from("rosters")
          .select("manager_id, league_id")
          .eq("phase_id", phaseId)
          .eq("coureur_id", selectedCoureur.id);

        if (rostersError) throw rostersError;

        const ownedPairs = (rostersData || []).filter((r: any) => r.manager_id);

        if (ownedPairs.length === 0) {
          // Aucun propriétaire : on enregistre une trace du bonus sans manager ni ligue
          const { error } = await supabase.from("bonus_points").insert([{
            phase_id: phaseId,
            bonus_type: bonusType,
            coureur_id: selectedCoureur.id,
            manager_id: null,
            league_id: null,
            course_id: courseIdToSave,
            points: parseInt(points),
            commentaire: commentaire || null,
            created_by: managerData.id,
          }]);
          if (error) throw error;
          toast.success("Bonus enregistré pour le coureur (aucun manager propriétaire sur cette phase)");
        } else {
          // Un bonus par couple (manager, ligue), dédoublonné
          const uniquePairs = Array.from(
            new Map(
              ownedPairs.map((r: any) => [`${r.manager_id}|${r.league_id ?? ''}`, r])
            ).values()
          ) as Array<{ manager_id: string; league_id: string | null }>;

          const bonusInserts = uniquePairs.map(roster => ({
            phase_id: phaseId,
            bonus_type: bonusType,
            coureur_id: selectedCoureur.id,
            manager_id: roster.manager_id,
            league_id: roster.league_id,
            course_id: courseIdToSave,
            points: parseInt(points),
            commentaire: commentaire || null,
            created_by: managerData.id,
          }));

          const { error } = await supabase.from("bonus_points").insert(bonusInserts);
          if (error) throw error;

          const managersCount = new Set(uniquePairs.map(p => p.manager_id)).size;
          const leaguesCount = new Set(uniquePairs.map(p => p.league_id)).size;
          toast.success(`Bonus attribué à ${managersCount} manager(s) dans ${leaguesCount} ligue(s)`);
        }


      } else {
        const { error } = await supabase.from("bonus_points").insert([{
          phase_id: phaseId,
          bonus_type: bonusType,
          coureur_id: selectedCoureur.id,
          manager_id: selectedCoureur.manager_id,
          course_id: courseIdToSave,
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
    setEditCourseId(bonus.course_id || "");
    setEditDialogOpen(true);
  };

  const editCourseRequired = bonusToEdit?.bonus_type === 'first_win' || bonusToEdit?.bonus_type === 'itt';

  const handleEdit = async () => {
    if (!bonusToEdit || !editPoints) return;

    if (editCourseRequired && !editCourseId) {
      toast.error("La course est obligatoire pour ce type de bonus");
      return;
    }

    setIsEditing(true);
    try {
      const updatePayload: any = {
        points: parseFloat(editPoints),
        commentaire: editCommentaire || null,
        updated_at: new Date().toISOString(),
      };
      if (editCourseRequired) {
        updatePayload.course_id = editCourseId;
      }

      // For first_win / itt: bonus is shared across all managers owning the rider.
      // Update all rows that share (phase, bonus_type, coureur) so the course stays consistent.
      let query = supabase.from("bonus_points").update(updatePayload);
      if (editCourseRequired) {
        query = query
          .eq("phase_id", bonusToEdit.phase_id || phaseId)
          .eq("bonus_type", bonusToEdit.bonus_type)
          .eq("coureur_id", bonusToEdit.coureur_id);
      } else {
        query = query.eq("id", bonusToEdit.id);
      }
      const { error } = await query;

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

  const recalcScopeLabel = [
    recalcCourseId === "all"
      ? "toutes les courses"
      : `course « ${(coursesMap.get(recalcCourseId) as any)?.nom || recalcCourseId} »`,
    recalcEtape === "all"
      ? "toutes les étapes"
      : recalcEtape === "final"
        ? "classements finaux uniquement"
        : `étape ${recalcEtape}`,
    recalcCoureur ? `coureur « ${recalcCoureur.nom || recalcCoureur.coureur_nom} »` : "tous les coureurs",
  ].join(" · ");

  const handleRecalculate = async () => {
    if (!phaseId) {
      toast.error("Sélectionne une phase précise (pas « Toutes les phases ») pour lancer le recalcul.");
      return;
    }

    setIsRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('recalculate-rider-bonuses', {
        body: {
          phase_id: phaseId,
          course_id: recalcCourseId === "all" ? null : recalcCourseId,
          etape_scope: recalcEtape === "all" ? "all" : recalcEtape === "final" ? "final" : "stage",
          etape_numero: recalcEtape === "all" || recalcEtape === "final" ? null : Number(recalcEtape),
          coureur_id: recalcCoureur ? (recalcCoureur.id || recalcCoureur.coureur_id) : null,
        },
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
            Recalcule les bonus « Coureur Bonusé » à partir des points actuels du ledger.
            Par défaut, toute la phase est traitée ; tu peux restreindre le périmètre à une course,
            une étape précise ou un seul coureur. Seuls les bonus du périmètre choisi sont supprimés puis régénérés.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Course */}
            <div className="space-y-2">
              <Label>Course</Label>
              <Popover open={recalcCoursePopoverOpen} onOpenChange={setRecalcCoursePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                    disabled={!phaseId}
                  >
                    <span className="truncate">
                      {recalcCourseId === "all"
                        ? "Toutes les courses"
                        : (coursesMap.get(recalcCourseId) as any)?.nom || recalcCourseId}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher une course..." />
                    <CommandList>
                      <CommandEmpty>Aucune course trouvée</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="toutes les courses"
                          onSelect={() => {
                            setRecalcCourseId("all");
                            setRecalcEtape("all");
                            setRecalcCoursePopoverOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", recalcCourseId === "all" ? "opacity-100" : "opacity-0")} />
                          Toutes les courses
                        </CommandItem>
                        {courses.map((c: any) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.nom} ${c.id}`}
                            onSelect={() => {
                              setRecalcCourseId(c.id);
                              setRecalcEtape("all");
                              setRecalcCoursePopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", recalcCourseId === c.id ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1 truncate">{c.nom}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Étape */}
            <div className="space-y-2">
              <Label>Étape</Label>
              <Select
                value={recalcEtape}
                onValueChange={setRecalcEtape}
                disabled={recalcCourseId === "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les étapes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les étapes</SelectItem>
                  <SelectItem value="final">Classements finaux</SelectItem>
                  {recalcEtapes.map((n: number) => (
                    <SelectItem key={n} value={String(n)}>Étape {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recalcCourseId !== "all" && recalcEtapes.length === 0 && (
                <p className="text-xs text-muted-foreground">Course sans étapes dans le ledger.</p>
              )}
            </div>

            {/* Coureur */}
            <div className="space-y-2">
              <Label>Coureur</Label>
              <CoureursCombobox
                phaseId={phaseId}
                value={recalcCoureur?.id || recalcCoureur?.coureur_id || null}
                onSelect={(c) => setRecalcCoureur(c)}
                placeholder="Tous les coureurs"
                showManager
                context="super-admin"
                disabled={!phaseId}
              />
              {recalcCoureur && (
                <Button variant="ghost" size="sm" onClick={() => setRecalcCoureur(null)}>
                  Réinitialiser (tous les coureurs)
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Périmètre : {recalcScopeLabel}
          </p>

          <Button
            variant="outline"
            onClick={() => setRecalculateDialogOpen(true)}
            disabled={isRecalculating || !phaseId}
          >
            {isRecalculating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <RefreshCw className="h-4 w-4 mr-2" />
            Recalculer les bonus coureur
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
                {selectedCoureur && (bonusType === 'first_win' || bonusType === 'itt') && selectedRiderOwners?.length === 0 && (
                  <p className="text-xs text-destructive">
                    Ce coureur n'est possédé par aucun manager sur cette phase : le bonus sera enregistré sans manager ni ligue (aucun point attribué).
                  </p>

                )}

              </div>

              {courseRequired && (
                <div className="space-y-2">
                  <Label>Course *</Label>
                  <Popover open={coursePopoverOpen} onOpenChange={setCoursePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        {selectedCourseId
                          ? (coursesMap.get(selectedCourseId) as any)?.nom
                          : "Sélectionner une course..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Rechercher une course..." />
                        <CommandList>
                          <CommandEmpty>Aucune course trouvée</CommandEmpty>
                          <CommandGroup>
                            {courses.map((c: any) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.nom} ${c.id}`}
                                onSelect={() => {
                                  setSelectedCourseId(c.id);
                                  setCoursePopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCourseId === c.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="flex-1 truncate">{c.nom}</span>
                                {c.date_debut && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {new Date(c.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                  </span>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Course à laquelle ce bonus est rattaché. Il n'apparaîtra que dans les ligues incluant cette course.
                  </p>
                </div>
              )}
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
                  <TableHead>Ligue</TableHead>
                  <TableHead>Course</TableHead>
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
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{bonus.league_name || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {bonus.course_id
                          ? ((coursesMap.get(bonus.course_id) as any)?.nom || bonus.course_id)
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
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

              {editCourseRequired && (
                <div className="space-y-2">
                  <Label>Course *</Label>
                  <Popover open={editCoursePopoverOpen} onOpenChange={setEditCoursePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        {editCourseId
                          ? (coursesMap.get(editCourseId) as any)?.nom || editCourseId
                          : "Sélectionner une course..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Rechercher une course..." />
                        <CommandList>
                          <CommandEmpty>Aucune course trouvée</CommandEmpty>
                          <CommandGroup>
                            {courses.map((c: any) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.nom} ${c.id}`}
                                onSelect={() => {
                                  setEditCourseId(c.id);
                                  setEditCoursePopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    editCourseId === c.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="flex-1 truncate">{c.nom}</span>
                                {c.date_debut && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {new Date(c.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                  </span>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    La modification s'applique à toutes les attributions de ce bonus pour ce coureur sur cette phase.
                  </p>
                </div>
              )}

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
              Cette action va <strong>supprimer</strong> les bonus « Coureur Bonusé (+25%) » du périmètre suivant
              et les <strong>régénérer</strong> à partir des points actuels du ledger :
              <br /><br />
              <strong>{recalcScopeLabel}</strong>
              <br /><br />
              Les bonus hors de ce périmètre, ainsi que les bonus First Win et ITT, ne sont pas affectés.
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

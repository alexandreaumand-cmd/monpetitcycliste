import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2, Target, Clock, Zap } from "lucide-react";
import { CoureurSearchCombobox } from "@/components/admin/coureurs/CoureurSearchCombobox";
import { format, isPast } from "date-fns";
import { fr } from "date-fns/locale";

const PRONOSTIC_TYPES = [
  { value: 'one_day_winner', label: 'Vainqueur course d\'un jour' },
  { value: 'stage_winner', label: 'Vainqueur d\'étape' },
  { value: 'gc_winner', label: 'Vainqueur du classement général' },
];

export const PronosticDeadlinesManager = () => {
  const { t } = useTranslation("arena");
  const queryClient = useQueryClient();

  // Form state
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [pronosticType, setPronosticType] = useState("");
  const [etapeNumero, setEtapeNumero] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("12:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Evaluate state
  const [evaluating, setEvaluating] = useState<string | null>(null);

  // Fetch upcoming courses
  const { data: courses } = useQuery({
    queryKey: ["admin-upcoming-courses"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, categorie, type_course, date_debut, date_fin")
        .or(`date_fin.gte.${today},date_debut.gte.${today}`)
        .order("date_debut", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing deadlines
  const { data: deadlines, isLoading: deadlinesLoading } = useQuery({
    queryKey: ["admin-pronostic-deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arena_pronostic_deadlines")
        .select("id, course_id, etape_numero, pronostic_type, deadline_at, reminder_sent_at, courses(nom, categorie)")
        .order("deadline_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async () => {
    if (!selectedCourseId || !pronosticType || !deadlineDate) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (pronosticType === 'stage_winner' && !etapeNumero) {
      toast.error("Numéro d'étape requis pour le type 'Vainqueur d\'étape'");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: manager } = await supabase
        .from("managers")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!manager?.id) throw new Error("Profil manager non trouvé");

      const deadlineAt = new Date(`${deadlineDate}T${deadlineTime}:00`).toISOString();

      const { error } = await supabase.from("arena_pronostic_deadlines").insert({
        course_id: selectedCourseId,
        etape_numero: pronosticType === 'stage_winner' ? parseInt(etapeNumero) : null,
        pronostic_type: pronosticType,
        deadline_at: deadlineAt,
        created_by: manager.id,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error("Une deadline existe déjà pour cette course/étape/type");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Deadline créée avec succès");
      queryClient.invalidateQueries({ queryKey: ["admin-pronostic-deadlines"] });
      queryClient.invalidateQueries({ queryKey: ["arena-pronostic-deadlines"] });

      // Reset form
      setEtapeNumero("");
      setDeadlineDate("");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("arena_pronostic_deadlines")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      toast.success("Deadline supprimée");
      queryClient.invalidateQueries({ queryKey: ["admin-pronostic-deadlines"] });
      queryClient.invalidateQueries({ queryKey: ["arena-pronostic-deadlines"] });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression");
    } finally {
      setDeleteId(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleEvaluate = async (deadline: any) => {
    setEvaluating(deadline.id);
    try {
      const { data, error } = await supabase.functions.invoke("arena-evaluate-pronostics", {
        body: {
          course_id: deadline.course_id,
          etape_numero: deadline.etape_numero,
          pronostic_type: deadline.pronostic_type,
        },
      });
      if (error) throw error;
      toast.success(`Évaluation terminée : ${data.correct_count} correct(s), ${data.incorrect_count} incorrect(s)`);
      queryClient.invalidateQueries({ queryKey: ["arena-my-pronostics"] });
      queryClient.invalidateQueries({ queryKey: ["arena-pronostic-standings"] });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'évaluation");
    } finally {
      setEvaluating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Deadline Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nouvelle Deadline de Pronostic
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une course" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.nom} {course.categorie ? `(${course.categorie})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type de pronostic *</Label>
              <Select value={pronosticType} onValueChange={setPronosticType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {PRONOSTIC_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pronosticType === 'stage_winner' && (
              <div className="space-y-2">
                <Label>Numéro d'étape *</Label>
                <Input
                  type="number"
                  value={etapeNumero}
                  onChange={(e) => setEtapeNumero(e.target.value)}
                  placeholder="1"
                  min="1"
                  max="21"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Date limite *</Label>
              <Input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Heure limite</Label>
              <Input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer la deadline
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Deadlines Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Deadlines configurées
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deadlinesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !deadlines?.length ? (
            <p className="text-center py-8 text-muted-foreground">
              Aucune deadline configurée
            </p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Étape</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadlines.map((dl: any) => {
                    const expired = isPast(new Date(dl.deadline_at));
                    return (
                      <TableRow key={dl.id}>
                        <TableCell className="font-medium">
                          {dl.courses?.nom || dl.course_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PRONOSTIC_TYPES.find(t => t.value === dl.pronostic_type)?.label || dl.pronostic_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{dl.etape_numero || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(dl.deadline_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {expired ? (
                            <Badge variant="secondary">Clos</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Ouvert</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {expired && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEvaluate(dl)}
                                disabled={evaluating === dl.id}
                              >
                                {evaluating === dl.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Zap className="h-4 w-4" />
                                )}
                                <span className="ml-1 hidden sm:inline">Évaluer</span>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeleteId(dl.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
              Êtes-vous sûr de vouloir supprimer cette deadline ? Les pronostics existants ne seront pas supprimés.
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

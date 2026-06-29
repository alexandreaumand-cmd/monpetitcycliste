import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Calendar, Plus, Loader2 } from "lucide-react";
import { CoursesTable } from "./courses/CoursesTable";
import { CoursesFilters } from "./courses/CoursesFilters";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type NewCourseState = {
  nom: string;
  date_debut: string;
  date_fin: string;
  categorie: string;
  phase_id: string;
  type_course: "one_day" | "stage_race";
  pays: string;
  uci_code: string;
  wt_tier: string;
  pcs_slug: string;
  route_image_url: string;
};

const EMPTY_COURSE: NewCourseState = {
  nom: "",
  date_debut: "",
  date_fin: "",
  categorie: "",
  phase_id: "",
  type_course: "one_day",
  pays: "",
  uci_code: "",
  wt_tier: "",
  pcs_slug: "",
  route_image_url: "",
};

export const CoursesManager = () => {
  const [filters, setFilters] = useState({
    phase_id: "all",
    saison_id: "all",
    statut: "all",
    search: "",
    categorie: "all",
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "duplicate">("create");
  const [newCourse, setNewCourse] = useState<NewCourseState>(EMPTY_COURSE);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch phases pour le dropdown de création
  const { data: phases } = useQuery({
    queryKey: ['phases-for-create'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('id, index_dans_saison, saisons(annee)')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch catégories depuis scoring_rules
  const { data: categories } = useQuery({
    queryKey: ['scoring-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_rules')
        .select('categorie')
        .order('categorie');
      if (error) throw error;
      const unique = [...new Set(data.map(r => r.categorie))];
      return unique;
    },
  });

  // Fetch courses avec filtres
  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin-courses', filters],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select(`
          *,
          phases(id, index_dans_saison, saisons(id, annee))
        `)
        .order('date_debut', { ascending: false });

      if (filters.phase_id !== "all") {
        query = query.eq('phase_id', filters.phase_id);
      }
      if (filters.saison_id !== "all") {
        const { data: phasesForSaison } = await supabase
          .from('phases')
          .select('id')
          .eq('saison_id', filters.saison_id);

        if (phasesForSaison && phasesForSaison.length > 0) {
          const phaseIds = phasesForSaison.map(p => p.id);
          query = query.in('phase_id', phaseIds);
        }
      }
      if (filters.statut !== "all") {
        query = query.eq('statut', filters.statut as "completed" | "scheduled");
      }
      if (filters.categorie !== "all") {
        query = query.eq('categorie', filters.categorie);
      }
      if (filters.search) {
        query = query.ilike('nom', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Mutation pour créer une course
  const createCourseMutation = useMutation({
    mutationFn: async (courseData: NewCourseState) => {
      const generateCourseId = (nom: string): string => {
        const slug = nom
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const timestamp = Date.now().toString(36);
        return `${slug}-${timestamp}`;
      };

      const courseId = generateCourseId(courseData.nom);

      const payload: any = {
        id: courseId,
        nom: courseData.nom,
        date_debut: courseData.date_debut,
        date_fin: courseData.date_fin,
        categorie: courseData.categorie || null,
        phase_id: courseData.phase_id,
        type_course: courseData.type_course,
        pays: courseData.pays || null,
        uci_code: courseData.uci_code || null,
        wt_tier: courseData.wt_tier || null,
        pcs_slug: courseData.pcs_slug || null,
        route_image_url: courseData.route_image_url || null,
        statut: 'scheduled',
      };

      const { data, error } = await supabase
        .from('courses')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast({
        title: "✅ Course créée",
        description: "La course a été ajoutée avec succès",
      });
      setCreateDialogOpen(false);
      setNewCourse(EMPTY_COURSE);
      setDialogMode("create");
    },
    onError: (error) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation pour update courses
  const updateCoursesMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; changes: any }>) => {
      const promises = updates.map(({ id, changes }) =>
        supabase.from('courses').update(changes).eq('id', id)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast({
        title: "✅ Modifications enregistrées",
        description: "Les courses ont été mises à jour",
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer une course (avec cascade contrôlée)
  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const steps: Array<[string, () => Promise<{ error: any }>]> = [
        ['points_ledger', () => supabase.from('points_ledger').delete().eq('course_id', courseId)],
        ['race_results', () => supabase.from('race_results').delete().eq('course_id', courseId)],
        ['race_result_sets', () => supabase.from('race_result_sets').delete().eq('course_id', courseId)],
        ['race_results_history', () => supabase.from('race_results_history').delete().eq('course_id', courseId)],
        ['courses', () => supabase.from('courses').delete().eq('id', courseId)],
      ];
      for (const [name, run] of steps) {
        const { error } = await run();
        if (error) throw new Error(`[${name}] ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast({
        title: "✅ Course supprimée",
        description: "La course et ses dépendances ont été supprimées",
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateCourse = () => {
    if (!newCourse.nom || !newCourse.date_debut || !newCourse.date_fin || !newCourse.phase_id) {
      toast({
        title: "⚠️ Champs manquants",
        description: "Veuillez remplir au minimum le nom, les dates et la phase",
        variant: "destructive",
      });
      return;
    }
    createCourseMutation.mutate(newCourse);
  };

  const handleDelete = (courseId: string, courseName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la course "${courseName}" ?\n\nCette action est irréversible.`)) {
      deleteCourseMutation.mutate(courseId);
    }
  };

  const handleDuplicate = (course: any) => {
    const rawType = (course.type_course ?? "").toString().toLowerCase();
    const type_course: "one_day" | "stage_race" = rawType.includes("stage") ? "stage_race" : "one_day";
    setNewCourse({
      nom: `${course.nom ?? ""} (copie)`,
      date_debut: course.date_debut ?? "",
      date_fin: course.date_fin ?? "",
      categorie: course.categorie ?? "",
      phase_id: course.phase_id ?? "",
      type_course,
      pays: course.pays ?? "",
      uci_code: course.uci_code ?? "",
      wt_tier: course.wt_tier ?? "",
      pcs_slug: course.pcs_slug ?? "",
      route_image_url: course.route_image_url ?? "",
    });
    setDialogMode("duplicate");
    setCreateDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setNewCourse(EMPTY_COURSE);
      setDialogMode("create");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Calendar}
        title="Gestion des courses"
        subtitle="Éditer les informations des courses de la saison"
        actions={
          <Dialog open={createDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button onClick={() => { setDialogMode("create"); setNewCourse(EMPTY_COURSE); }}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {dialogMode === "duplicate" ? "Dupliquer la course" : "Créer une nouvelle course"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="course-name">Nom de la course *</Label>
                  <Input
                    id="course-name"
                    value={newCourse.nom}
                    onChange={(e) => setNewCourse({ ...newCourse, nom: e.target.value })}
                    placeholder="Ex: Milano-Sanremo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date-debut">Date début *</Label>
                    <Input
                      id="date-debut"
                      type="date"
                      value={newCourse.date_debut}
                      onChange={(e) => setNewCourse({ ...newCourse, date_debut: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="date-fin">Date fin *</Label>
                    <Input
                      id="date-fin"
                      type="date"
                      value={newCourse.date_fin}
                      onChange={(e) => setNewCourse({ ...newCourse, date_fin: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phase-select">Phase *</Label>
                  <Select
                    value={newCourse.phase_id}
                    onValueChange={(value) => setNewCourse({ ...newCourse, phase_id: value })}
                  >
                    <SelectTrigger id="phase-select">
                      <SelectValue placeholder="Sélectionner une phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {phases?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          Phase {p.index_dans_saison} - {p.saisons?.annee}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="categorie">Catégorie</Label>
                    <Select
                      value={newCourse.categorie}
                      onValueChange={(value) => setNewCourse({ ...newCourse, categorie: value })}
                    >
                      <SelectTrigger id="categorie">
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {categories?.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="type-course">Type de course</Label>
                    <Select
                      value={newCourse.type_course}
                      onValueChange={(value: "one_day" | "stage_race") =>
                        setNewCourse({ ...newCourse, type_course: value })
                      }
                    >
                      <SelectTrigger id="type-course">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_day">Course d'un jour</SelectItem>
                        <SelectItem value="stage_race">Course par étapes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pays">Pays</Label>
                    <Input
                      id="pays"
                      value={newCourse.pays}
                      onChange={(e) => setNewCourse({ ...newCourse, pays: e.target.value })}
                      placeholder="Ex: ITA, FRA, BEL"
                    />
                  </div>
                  <div>
                    <Label htmlFor="uci-code">Code UCI</Label>
                    <Input
                      id="uci-code"
                      value={newCourse.uci_code}
                      onChange={(e) => setNewCourse({ ...newCourse, uci_code: e.target.value })}
                      placeholder="Ex: 1.UWT"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="wt-tier">WT Tier</Label>
                    <Input
                      id="wt-tier"
                      value={newCourse.wt_tier}
                      onChange={(e) => setNewCourse({ ...newCourse, wt_tier: e.target.value })}
                      placeholder="Ex: WT, Pro"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pcs-slug">PCS slug</Label>
                    <Input
                      id="pcs-slug"
                      value={newCourse.pcs_slug}
                      onChange={(e) => setNewCourse({ ...newCourse, pcs_slug: e.target.value })}
                      placeholder="Ex: milano-sanremo"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="route-image-url">URL image du parcours</Label>
                  <Input
                    id="route-image-url"
                    value={newCourse.route_image_url}
                    onChange={(e) => setNewCourse({ ...newCourse, route_image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  disabled={createCourseMutation.isPending}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCreateCourse}
                  disabled={createCourseMutation.isPending}
                >
                  {createCourseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Plus className="h-4 w-4 mr-2" />
                  {dialogMode === "duplicate" ? "Créer la copie" : "Créer la course"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <CoursesFilters filters={filters} onFiltersChange={setFilters} />

      <CoursesTable
        courses={courses || []}
        isLoading={isLoading}
        onSave={(updates) => updateCoursesMutation.mutate(updates)}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />
    </div>
  );
};

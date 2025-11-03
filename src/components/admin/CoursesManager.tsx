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

export const CoursesManager = () => {
  const [filters, setFilters] = useState({
    phase_id: "all",
    saison_id: "all",
    statut: "all",
    search: "",
    categorie: "all",
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    nom: "",
    date_debut: "",
    date_fin: "",
    categorie: "",
    phase_id: "",
    type_course: "one_day" as "one_day" | "stage_race",
    pays: "",
  });
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
    mutationFn: async (courseData: any) => {
      // Générer un ID unique basé sur le nom de la course
      const generateCourseId = (nom: string): string => {
        const slug = nom
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
          .replace(/[^a-z0-9]+/g, '-')     // Remplacer les espaces/caractères spéciaux par des tirets
          .replace(/^-+|-+$/g, '');        // Enlever les tirets au début/fin
        const timestamp = Date.now().toString(36); // Timestamp en base 36 pour plus court
        return `${slug}-${timestamp}`;
      };

      const courseId = generateCourseId(courseData.nom);

      const { data, error } = await supabase
        .from('courses')
        .insert({
          ...courseData,
          id: courseId,
          statut: 'scheduled',
        })
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
      setNewCourse({
        nom: "",
        date_debut: "",
        date_fin: "",
        categorie: "",
        phase_id: "",
        type_course: "one_day",
        pays: "",
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

  // Mutation pour supprimer une course
  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast({
        title: "✅ Course supprimée",
        description: "La course a été supprimée avec succès",
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Calendar}
        title="Gestion des courses"
        subtitle="Éditer les informations des courses de la saison"
        actions={
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer une nouvelle course</DialogTitle>
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
                    <Input
                      id="categorie"
                      value={newCourse.categorie}
                      onChange={(e) => setNewCourse({ ...newCourse, categorie: e.target.value })}
                      placeholder="Ex: WT, 1.1, 2.1"
                    />
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

                <div>
                  <Label htmlFor="pays">Pays</Label>
                  <Input
                    id="pays"
                    value={newCourse.pays}
                    onChange={(e) => setNewCourse({ ...newCourse, pays: e.target.value })}
                    placeholder="Ex: ITA, FRA, BEL"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
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
                  Créer la course
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
      />
    </div>
  );
};

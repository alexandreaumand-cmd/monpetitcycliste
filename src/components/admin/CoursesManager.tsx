import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Calendar } from "lucide-react";
import { CoursesTable } from "./courses/CoursesTable";
import { CoursesFilters } from "./courses/CoursesFilters";
import { useToast } from "@/hooks/use-toast";

export const CoursesManager = () => {
  const [filters, setFilters] = useState({
    phase_id: "all",
    saison_id: "all",
    statut: "all",
    search: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      if (filters.search) {
        query = query.ilike('nom', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Calendar}
        title="Gestion des courses"
        subtitle="Éditer les informations des courses de la saison"
      />

      <CoursesFilters filters={filters} onFiltersChange={setFilters} />

      <CoursesTable
        courses={courses || []}
        isLoading={isLoading}
        onSave={(updates) => updateCoursesMutation.mutate(updates)}
      />
    </div>
  );
};

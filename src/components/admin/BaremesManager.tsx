import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BaremesFilters } from "./baremes/BaremesFilters";
import { BaremesTable } from "./baremes/BaremesTable";
import { AddBaremeDialog } from "./baremes/AddBaremeDialog";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { BarChart } from "lucide-react";

export function BaremesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    categorie: "all",
    type_classement: "all",
  });

  // Query pour charger les saisons
  const { data: saisons } = useQuery({
    queryKey: ['saisons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('*')
        .order('annee', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Query pour charger les barèmes
  const { data: baremes, isLoading } = useQuery({
    queryKey: ['admin-baremes', filters],
    queryFn: async () => {
      let query = supabase
        .from('scoring_rules')
        .select('*')
        .order('categorie', { ascending: true })
        .order('type_classement', { ascending: true })
        .order('place', { ascending: true });

      if (filters.categorie !== "all") {
        query = query.eq('categorie', filters.categorie);
      }
      if (filters.type_classement !== "all") {
        query = query.eq('type_classement', filters.type_classement as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Mutation pour créer un barème
  const createBaremeMutation = useMutation({
    mutationFn: async (newBareme: any) => {
      const { error } = await supabase
        .from('scoring_rules')
        .insert([{
          ...newBareme,
          id: `${newBareme.categorie}_${newBareme.type_classement}_${newBareme.place}`.toLowerCase().replace(/\s+/g, '_'),
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-baremes'] });
      toast({
        title: "✅ Barème créé",
        description: "Le barème a été créé avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation pour mettre à jour les barèmes
  const updateBaremesMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; changes: any }>) => {
      const promises = updates.map(({ id, changes }) =>
        supabase
          .from('scoring_rules')
          .update(changes)
          .eq('id', id)
      );
      
      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-baremes'] });
      toast({
        title: "✅ Modifications sauvegardées",
        description: "Les barèmes ont été mis à jour avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer un barème
  const deleteBaremeMutation = useMutation({
    mutationFn: async (baremeId: string) => {
      const { error } = await supabase
        .from('scoring_rules')
        .delete()
        .eq('id', baremeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-baremes'] });
      toast({
        title: "✅ Barème supprimé",
        description: "Le barème a été supprimé avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleResetFilters = () => {
    setFilters({
      categorie: "all",
      type_classement: "all",
    });
  };

  const handleDelete = (baremeId: string, baremeInfo: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ce barème ?\n\n${baremeInfo}\n\nCette action est irréversible.`)) {
      deleteBaremeMutation.mutate(baremeId);
    }
  };

  const handleAddBareme = (newBareme: any) => {
    createBaremeMutation.mutate(newBareme);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart}
        title="Gestion des barèmes"
        subtitle="Gérez les points attribués par catégorie et position"
        actions={<AddBaremeDialog onAdd={handleAddBareme} />}
        filters={
          <BaremesFilters
            saisons={saisons || []}
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
          />
        }
      />

      <BaremesTable
        baremes={baremes || []}
        isLoading={isLoading}
        onSave={(updates) => updateBaremesMutation.mutate(updates)}
        onDelete={handleDelete}
      />
    </div>
  );
}

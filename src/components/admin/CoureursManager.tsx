import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Users, Plus } from "lucide-react";
import { CoureursTable } from "./coureurs/CoureursTable";
import { CoureursFilters } from "./coureurs/CoureursFilters";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const CoureursManager = () => {
  const [filters, setFilters] = useState({
    saison_id: "",
    search: "",
    equipe: "all",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch coureurs pour une saison spécifique
  const { data: coureurs, isLoading } = useQuery({
    queryKey: ['admin-coureurs', filters],
    queryFn: async () => {
      if (!filters.saison_id) return [];

      let query = supabase
        .from('coureurs_saisons')
        .select(`
          *,
          coureurs!inner(id, nom, uci_id)
        `)
        .eq('saison_id', filters.saison_id)
        .order('coureurs(nom)', { ascending: true });

      if (filters.search) {
        query = query.ilike('coureurs.nom', `%${filters.search}%`);
      }
      if (filters.equipe !== "all") {
        query = query.eq('equipe', filters.equipe);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!filters.saison_id,
  });

  // Mutation pour update coureurs_saisons
  const updateCoureursMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; changes: any }>) => {
      const promises = updates.map(({ id, changes }) =>
        supabase.from('coureurs_saisons').update(changes).eq('id', id)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coureurs'] });
      toast({
        title: "✅ Modifications enregistrées",
        description: "Les coureurs ont été mis à jour",
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
        icon={Users}
        title="Gestion des coureurs"
        subtitle="Éditer les équipes et cotes des coureurs par saison"
        actions={
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un coureur
          </Button>
        }
      />

      <CoureursFilters filters={filters} onFiltersChange={setFilters} />

      {filters.saison_id ? (
        <CoureursTable
          coureurs={coureurs || []}
          isLoading={isLoading}
          onSave={(updates) => updateCoureursMutation.mutate(updates)}
        />
      ) : (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Sélectionnez une saison pour voir les coureurs</p>
        </Card>
      )}
    </div>
  );
};

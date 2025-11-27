import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Shield } from "lucide-react";
import { EquipesSaisonsTable } from "./equipes/EquipesSaisonsTable";
import { EquipesSaisonsFilters } from "./equipes/EquipesSaisonsFilters";
import { CreateEquipeDialog } from "./equipes/CreateEquipeDialog";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

export const EquipesSaisonsManager = () => {
  const [filters, setFilters] = useState({
    saison_id: "",
    search: "",
    categorie: "all",
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch équipes saisons pour une saison spécifique
  const { data: equipesSaisons, isLoading } = useQuery({
    queryKey: ['admin-equipes-saisons', filters],
    queryFn: async () => {
      if (!filters.saison_id) return [];

      let query = supabase
        .from('equipes_saisons')
        .select(`
          *,
          saisons!inner(annee),
          equipes!inner(code_court, nom_complet)
        `)
        .eq('saison_id', filters.saison_id);

      // Filtre de recherche par nom
      if (filters.search) {
        query = query.ilike('nom_affiche', `%${filters.search}%`);
      }

      // Filtre par catégorie
      if (filters.categorie !== "all") {
        if (filters.categorie === "none") {
          query = query.is('categorie', null);
        } else {
          query = query.eq('categorie', filters.categorie);
        }
      }

      query = query.order('nom_affiche');

      const { data, error } = await query;
      if (error) throw error;

      // Enrichir avec le nombre de coureurs
      const enrichedData = await Promise.all(
        (data || []).map(async (equipe) => {
          const { count } = await supabase
            .from('coureurs_saisons')
            .select('*', { count: 'exact', head: true })
            .eq('equipe_id', equipe.equipe_id)
            .eq('saison_id', equipe.saison_id);
          
          return {
            ...equipe,
            nb_coureurs: count || 0,
          };
        })
      );

      return enrichedData;
    },
    enabled: !!filters.saison_id,
  });

  // Mutation pour update équipes_saisons
  const updateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; changes: any }>) => {
      const promises = updates.map(({ id, changes }) =>
        supabase.from('equipes_saisons').update(changes).eq('id', id)
      );
      const results = await Promise.all(promises);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`${errors.length} erreur(s) lors de la mise à jour`);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-equipes-saisons'] });
      toast({
        title: "✅ Modifications enregistrées",
        description: "Les équipes ont été mises à jour",
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

  // Mutation pour delete équipe_saison
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipes_saisons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-equipes-saisons'] });
      toast({
        title: "✅ Équipe supprimée",
        description: "L'équipe a été supprimée de la saison",
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
        icon={Shield}
        title="Gestion des équipes par saison"
        subtitle="Éditer les noms et catégories des équipes"
      />

      <EquipesSaisonsFilters 
        filters={filters} 
        onFiltersChange={setFilters}
        onCreateClick={() => setShowCreateDialog(true)}
      />

      <CreateEquipeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        defaultSaisonId={filters.saison_id}
      />

      {filters.saison_id ? (
        <EquipesSaisonsTable
          equipesSaisons={equipesSaisons || []}
          isLoading={isLoading}
          onSave={(updates) => updateMutation.mutate(updates)}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      ) : (
        <Card className="p-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Sélectionnez une saison pour voir les équipes</p>
        </Card>
      )}
    </div>
  );
};

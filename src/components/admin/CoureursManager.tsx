import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Users, Plus } from "lucide-react";
import { CoureursTable } from "./coureurs/CoureursTable";
import { CoureursFilters } from "./coureurs/CoureursFilters";
import { AddCoureurDialog } from "./coureurs/AddCoureurDialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const CoureursManager = () => {
  const [filters, setFilters] = useState({
    saison_ids: [] as string[],
    search: "",
    equipe_ids: [] as string[],
    cote_ranges: [] as string[],
    equipe_categories: [] as string[],
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Charger la saison par défaut (la plus récente) une seule fois
  const { data: defaultSeason } = useQuery({
    queryKey: ['default-season'],
    queryFn: async () => {
      const { data } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
  });

  // Initialiser les filtres une seule fois au chargement
  useEffect(() => {
    if (defaultSeason?.id && filters.saison_ids.length === 0) {
      setFilters(prev => ({ ...prev, saison_ids: [defaultSeason.id] }));
    }
  }, [defaultSeason?.id]); // Enlever filters.saison_ids.length pour éviter la boucle

  // Requête simplifiée pour charger les coureurs via la vue
  const { data: coureurs, isLoading } = useQuery({
    queryKey: ['admin-coureurs', filters],
    queryFn: async () => {
      if (filters.saison_ids.length === 0) return [];

      let query = supabase
        .from('v_coureurs_saisons_admin')
        .select('*')
        .in('saison_id', filters.saison_ids)
        .eq('actif', true);

      if (filters.search) {
        query = query.ilike('coureur_nom', `%${filters.search}%`);
      }
      if (filters.equipe_ids.length > 0) {
        query = query.in('equipe_id', filters.equipe_ids);
      }

      if (filters.cote_ranges.length > 0) {
        const priceFilters = filters.cote_ranges.map(range => {
          if (range === "150+") {
            return { min: 150, max: 999 };
          }
          const [min, max] = range.split('-').map(Number);
          return { min, max };
        });

        query = query.or(
          priceFilters
            .map(({ min, max }) => `and(prix_initial.gte.${min},prix_initial.lte.${max})`)
            .join(',')
        );
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data?.sort((a, b) => 
        (a.coureur_nom || '').localeCompare(b.coureur_nom || '')
      ) || [];
    },
    enabled: filters.saison_ids.length > 0,
  });

  // Pré-charger les équipes pour le cache
  const { data: preloadedEquipes } = useQuery({
    queryKey: ['equipes-for-table', filters.saison_ids],
    queryFn: async () => {
      if (filters.saison_ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from('equipes_saisons')
        .select('equipe_id, saison_id, nom_affiche, trigramme, categorie, equipes!inner(code_court, nom_complet)')
        .in('saison_id', filters.saison_ids)
        .order('nom_affiche');
      
      if (error) throw error;
      return data || [];
    },
    enabled: filters.saison_ids.length > 0,
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });

  // Enrichir les coureurs avec les infos d'équipe et filtrer par catégorie
  const enrichedCoureurs = coureurs?.map(cs => {
    const equipeInfo = preloadedEquipes?.find(
      eq => eq.equipe_id === cs.equipe_id && eq.saison_id === cs.saison_id
    );
    return {
      ...cs,
      equipes_saisons: equipeInfo || null,
      equipe_categorie: equipeInfo?.categorie || null
    };
  }).filter(c => {
    // Filtre par catégorie d'équipe (côté client)
    if (filters.equipe_categories.length > 0) {
      return filters.equipe_categories.includes(c.equipe_categorie);
    }
    return true;
  }) || [];

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

  // Mutation pour désactiver un coureur (suppression logique)
  const deleteCoureursMutation = useMutation({
    mutationFn: async (coureurSaisonId: string) => {
      const { error } = await supabase
        .from('coureurs_saisons')
        .update({ actif: false })
        .eq('id', coureurSaisonId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coureurs'] });
      toast({
        title: "✅ Coureur désactivé",
        description: "Le coureur a été marqué comme inactif",
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

  // Mutation pour désactiver plusieurs coureurs en masse
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('coureurs_saisons')
        .update({ actif: false })
        .in('id', ids);
      
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['admin-coureurs'] });
      toast({
        title: "✅ Coureurs désactivés",
        description: `${ids.length} coureur${ids.length > 1 ? 's ont' : ' a'} été marqué${ids.length > 1 ? 's' : ''} comme inactif${ids.length > 1 ? 's' : ''}`,
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
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un coureur
          </Button>
        }
      />

      <AddCoureurDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        defaultSaisonId={filters.saison_ids[0]}
      />

      <CoureursFilters filters={filters} onFiltersChange={setFilters} />

      {filters.saison_ids.length > 0 ? (
        <CoureursTable
          coureurs={enrichedCoureurs}
          isLoading={isLoading}
          onSave={(updates) => updateCoureursMutation.mutate(updates)}
          onDelete={(id) => deleteCoureursMutation.mutate(id)}
          onBulkDelete={(ids) => bulkDeleteMutation.mutate(ids)}
          preloadedEquipes={preloadedEquipes || []}
        />
      ) : (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Sélectionnez au moins une saison pour voir les coureurs</p>
        </Card>
      )}
    </div>
  );
};

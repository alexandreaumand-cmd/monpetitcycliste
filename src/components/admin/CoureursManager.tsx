import { useState, useEffect } from "react";
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
    saison_ids: [] as string[],
    search: "",
    equipe_ids: [] as string[],
    cote_ranges: [] as string[],
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Solution 1: Charger la saison par défaut (la plus récente)
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

  // Synchroniser avec les filtres quand la saison est chargée
  useEffect(() => {
    if (defaultSeason?.id && filters.saison_ids.length === 0) {
      setFilters(prev => ({ ...prev, saison_ids: [defaultSeason.id] }));
    }
  }, [defaultSeason?.id, filters.saison_ids.length]);

  // Solution 2: Requête optimisée avec un seul JOIN
  const { data: coureurs, isLoading } = useQuery({
    queryKey: ['admin-coureurs', filters],
    queryFn: async () => {
      if (filters.saison_ids.length === 0) return [];

      let query = supabase
        .from('coureurs_saisons')
        .select(`
          *,
          coureurs!inner(id, nom, uci_id),
          equipes_saisons(equipe_id, saison_id, nom_affiche, categorie, equipes(code_court, nom_complet)),
          saisons(id, annee)
        `)
        .in('saison_id', filters.saison_ids);

      if (filters.search) {
        query = query.ilike('coureurs.nom', `%${filters.search}%`);
      }
      if (filters.equipe_ids.length > 0) {
        query = query.in('equipe_id', filters.equipe_ids);
      }

      // Apply price range filters
      if (filters.cote_ranges.length > 0) {
        const priceFilters = filters.cote_ranges.map(range => {
          if (range === "150+") {
            return { min: 150, max: 999 };
          }
          const [min, max] = range.split('-').map(Number);
          return { min, max };
        });

        // Apply OR logic for multiple price ranges
        query = query.or(
          priceFilters
            .map(({ min, max }) => `and(prix_initial.gte.${min},prix_initial.lte.${max})`)
            .join(',')
        );
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('Erreur requête coureurs:', error);
        throw error;
      }
      console.log('Coureurs chargés:', data?.length || 0);
      
      // Tri côté client car PostgREST ne supporte pas order() sur les relations
      return data?.sort((a, b) => 
        (a.coureurs?.nom || '').localeCompare(b.coureurs?.nom || '')
      ) || [];
    },
    enabled: filters.saison_ids.length > 0,
  });

  // Solution 3: Pré-charger toutes les équipes pour le cache
  const { data: preloadedEquipes } = useQuery({
    queryKey: ['equipes-for-table', filters.saison_ids],
    queryFn: async () => {
      if (filters.saison_ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from('equipes_saisons')
        .select('equipe_id, saison_id, nom_affiche, equipes!inner(code_court, nom_complet)')
        .in('saison_id', filters.saison_ids)
        .order('nom_affiche');
      
      if (error) throw error;
      return data || [];
    },
    enabled: filters.saison_ids.length > 0,
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

      {filters.saison_ids.length > 0 ? (
        <CoureursTable
          coureurs={coureurs || []}
          isLoading={isLoading}
          onSave={(updates) => updateCoureursMutation.mutate(updates)}
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

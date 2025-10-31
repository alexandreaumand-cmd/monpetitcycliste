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
    saison_ids: [] as string[],
    search: "",
    equipe_ids: [] as string[],
    cote_ranges: [] as string[],
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch coureurs pour une saison spécifique
  const { data: coureurs, isLoading } = useQuery({
    queryKey: ['admin-coureurs', filters],
    queryFn: async () => {
      // Si aucune saison sélectionnée, on charge tous les coureurs
      let query = supabase
        .from('coureurs_saisons')
        .select(`
          *,
          coureurs!inner(id, nom, uci_id)
        `);

      if (filters.saison_ids.length > 0) {
        query = query.in('saison_id', filters.saison_ids);
      }

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
      
      query = query.order('coureurs(nom)', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with team and season information
      if (data && data.length > 0) {
        const uniqueEquipeIds = [...new Set(data.map(cs => cs.equipe_id).filter(Boolean))];
        const uniqueSaisonIds = [...new Set(data.map(cs => cs.saison_id).filter(Boolean))];
        
        // Fetch teams
        let equipesMap = new Map();
        if (uniqueEquipeIds.length > 0) {
          const equipesFilter = filters.saison_ids.length > 0
            ? filters.saison_ids
            : uniqueSaisonIds;

          const { data: equipesData } = await supabase
            .from('equipes_saisons')
            .select('equipe_id, saison_id, nom_affiche, categorie, equipes!inner(code_court, nom_complet)')
            .in('equipe_id', uniqueEquipeIds)
            .in('saison_id', equipesFilter);
          
          equipesMap = new Map(
            equipesData?.map(e => [`${e.equipe_id}_${e.saison_id}`, e]) || []
          );
        }

        // Fetch seasons
        let saisonsMap = new Map();
        if (uniqueSaisonIds.length > 0) {
          const { data: saisonsData } = await supabase
            .from('saisons')
            .select('id, annee')
            .in('id', uniqueSaisonIds);
          
          saisonsMap = new Map(
            saisonsData?.map(s => [s.id, s]) || []
          );
        }
        
        // Enrich each coureur with team and season info
        return data.map(cs => ({
          ...cs,
          equipes_saisons: equipesMap.get(`${cs.equipe_id}_${cs.saison_id}`) || null,
          saison: saisonsMap.get(cs.saison_id) || null
        }));
      }

      return data;
    },
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

      <CoureursTable
        coureurs={coureurs || []}
        isLoading={isLoading}
        onSave={(updates) => updateCoureursMutation.mutate(updates)}
      />
    </div>
  );
};

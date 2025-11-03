import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BaremesFilters } from "./baremes/BaremesFilters";
import { BaremesTable } from "./baremes/BaremesTable";
import { AddBaremeDialog } from "./baremes/AddBaremeDialog";
import { CopyBaremesDialog } from "./baremes/CopyBaremesDialog";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { BarChart } from "lucide-react";

export function BaremesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    saison_id: "dcbc02b7-3b3e-471d-9471-efa70743f808", // Saison 2025 par défaut
    categorie: "all",
    type_classement: "all",
  });

  // Log de debug pour vérifier les permissions (temporaire)
  useEffect(() => {
    const checkPermissions = async () => {
      const { data, error } = await supabase.rpc('is_superadmin');
      console.log('🔐 Is superadmin?', data, error);
    };
    checkPermissions();
  }, []);

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
        .from('scoring_rules_saisons')
        .select('*, saisons(annee)')
        .order('categorie', { ascending: true })
        .order('type_classement', { ascending: true })
        .order('place', { ascending: true });

      if (filters.saison_id !== "all") {
        query = query.eq('saison_id', filters.saison_id);
      }
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
        .from('scoring_rules_saisons')
        .insert([newBareme]);
      
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
          .from('scoring_rules_saisons')
          .update(changes)
          .eq('id', id)
          .select() // Récupérer les lignes modifiées pour vérifier le succès
      );
      
      const results = await Promise.all(promises);
      
      // Vérifier les erreurs explicites
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error('❌ Erreurs UPDATE:', errors);
        throw errors[0].error;
      }
      
      // Vérifier que des lignes ont bien été modifiées
      const emptyUpdates = results.filter(r => !r.data || r.data.length === 0);
      if (emptyUpdates.length > 0) {
        console.error('⚠️ Aucune ligne modifiée pour', emptyUpdates.length, 'UPDATE(s)');
        throw new Error(
          `${emptyUpdates.length} barème(s) n'ont pas pu être modifiés. Vérifiez vos permissions superadmin.`
        );
      }
      
      console.log('✅ UPDATE réussi:', results.length, 'ligne(s) modifiée(s)');
      return results;
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
        title: "❌ Erreur de sauvegarde",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer un barème
  const deleteBaremeMutation = useMutation({
    mutationFn: async (baremeId: string) => {
      const { error } = await supabase
        .from('scoring_rules_saisons')
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

  // Mutation pour supprimer plusieurs barèmes en masse
  const deleteBaremesBatchMutation = useMutation({
    mutationFn: async (baremeIds: string[]) => {
      const { error } = await supabase
        .from('scoring_rules_saisons')
        .delete()
        .in('id', baremeIds);
      
      if (error) throw error;
    },
    onSuccess: (_, baremeIds) => {
      queryClient.invalidateQueries({ queryKey: ['admin-baremes'] });
      toast({
        title: "✅ Suppression réussie",
        description: `${baremeIds.length} barème(s) supprimé(s)`,
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

  // Mutation pour copier des barèmes entre saisons
  const copyBaremesMutation = useMutation({
    mutationFn: async (params: {
      sourceSaisonId: string;
      targetSaisonId: string;
      filters?: { categorie?: string; type_classement?: string };
    }) => {
      // 1. Récupérer les barèmes source
      let query = supabase
        .from('scoring_rules_saisons')
        .select('*')
        .eq('saison_id', params.sourceSaisonId);
      
      if (params.filters?.categorie) {
        query = query.eq('categorie', params.filters.categorie);
      }
      if (params.filters?.type_classement) {
        query = query.eq('type_classement', params.filters.type_classement as any);
      }
      
      const { data: sourceBaremes, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      // 2. Créer les nouveaux barèmes
      const newBaremes = sourceBaremes.map(({ id, ...rest }) => ({
        ...rest,
        saison_id: params.targetSaisonId,
      }));
      
      const { error: insertError } = await supabase
        .from('scoring_rules_saisons')
        .insert(newBaremes);
      
      if (insertError) throw insertError;
      
      return newBaremes.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-baremes'] });
      toast({
        title: "✅ Copie réussie",
        description: `${count} barème(s) copié(s)`,
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
      saison_id: "dcbc02b7-3b3e-471d-9471-efa70743f808",
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

  const handleCopy = (params: {
    sourceSaisonId: string;
    targetSaisonId: string;
    filters?: { categorie?: string; type_classement?: string };
  }) => {
    copyBaremesMutation.mutate(params);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart}
        title="Gestion des barèmes"
        subtitle="Gérez les points attribués par catégorie et position"
        actions={
          <>
            <CopyBaremesDialog saisons={saisons || []} onCopy={handleCopy} />
            <AddBaremeDialog saisons={saisons || []} onAdd={handleAddBareme} />
          </>
        }
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
        saisons={saisons || []}
        isLoading={isLoading}
        onSave={(updates) => updateBaremesMutation.mutate(updates)}
        onDelete={handleDelete}
        onDeleteBatch={(ids) => deleteBaremesBatchMutation.mutate(ids)}
      />
    </div>
  );
}

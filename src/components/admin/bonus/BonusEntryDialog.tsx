import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BonusTypeSelector, type BonusType } from "./BonusTypeSelector";
import { RiderBonusForm } from "./RiderBonusForm";
import { ManagerBonusForm } from "./ManagerBonusForm";
import { BonusListTable } from "./BonusListTable";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLeague } from "@/contexts/LeagueContext";

type FormStep = 'select-type' | 'enter-data';

interface BonusEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
}

export const BonusEntryDialog = ({ open, onOpenChange, phaseId }: BonusEntryDialogProps) => {
  const { leagueId } = useLeague();
  const [step, setStep] = useState<FormStep>('select-type');
  const [selectedBonus, setSelectedBonus] = useState<BonusType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Fetch phase info
  const { data: phaseData } = useQuery({
    queryKey: ['phase', phaseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('phases')
        .select('index_dans_saison')
        .eq('id', phaseId)
        .single();
      return data;
    },
    enabled: open,
  });

  // Fetch existing bonuses - Direct DB call to bypass edge function deployment issue
  const { data: bonusesData, isLoading } = useQuery({
    queryKey: ['bonus-points', phaseId],
    queryFn: async () => {
      // Récupérer la saison_id de la phase
      const { data: phaseInfo } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', phaseId)
        .single();

      const { data, error } = await supabase
        .from('bonus_points')
        .select(`
          id,
          bonus_type,
          points,
          commentaire,
          created_at,
          coureur_id,
          coureur:coureurs(id, nom),
          manager:managers!bonus_points_manager_id_fkey(id, nom),
          target_manager:managers!bonus_points_target_manager_id_fkey(id, nom)
        `)
        .eq('phase_id', phaseId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Enrichir avec l'équipe de la saison
      const enrichedData = await Promise.all(
        (data || []).map(async (bonus) => {
          if (!bonus.coureur_id || !phaseInfo?.saison_id) {
            return { ...bonus, coureur: { ...bonus.coureur, equipe: 'N/A' } };
          }

          const { data: seasonData } = await supabase
            .from('coureurs_saisons')
            .select(`
              equipe_id,
              equipes_saisons!coureurs_saisons_equipe_id_saison_id_fkey(nom_affiche)
            `)
            .eq('coureur_id', bonus.coureur_id)
            .eq('saison_id', phaseInfo.saison_id)
            .maybeSingle();

          return {
            ...bonus,
            coureur: {
              ...bonus.coureur,
              equipe: (seasonData?.equipes_saisons as any)?.nom_affiche || 'N/A'
            }
          };
        })
      );
      
      return {
        bonuses: enrichedData
      };
    },
    enabled: open && !!phaseId,
  });

  const bonuses = bonusesData?.bonuses || [];

  const handleBonusTypeSelect = (bonus: BonusType) => {
    setSelectedBonus(bonus);
    setStep('enter-data');
  };

  const handleBack = () => {
    setStep('select-type');
    setSelectedBonus(null);
  };

  const handleSubmitRiderBonus = async (data: {
    coureur_id: string;
    manager_id: string | null;
    points: number;
    commentaire?: string;
  }): Promise<boolean> => {
    if (!selectedBonus) return false;

    setIsSubmitting(true);
    try {
      // Get current user's manager_id for created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Utilisateur non authentifié");
      }

      const { data: managerData, error: managerError } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (managerError) {
        throw new Error(`Erreur récupération manager: ${managerError.message}`);
      }

      if (!managerData?.id) {
        throw new Error("Aucun profil manager trouvé pour cet utilisateur");
      }

      if (!leagueId) {
        throw new Error("League ID manquant");
      }

      const bonusType = selectedBonus.type;
      const isMultiManagerBonus = bonusType === 'first_win' || bonusType === 'itt';

      if (isMultiManagerBonus) {
        // Pour first_win et itt: récupérer tous les managers qui ont ce coureur dans cette phase
        const { data: rostersData, error: rostersError } = await supabase
          .from('rosters')
          .select('manager_id, managers(nom)')
          .eq('phase_id', phaseId)
          .eq('coureur_id', data.coureur_id)
          .eq('league_id', leagueId!);

        if (rostersError) throw rostersError;

        if (!rostersData || rostersData.length === 0) {
          toast({
            title: "Aucun manager trouvé",
            description: "Ce coureur n'est possédé par aucun manager dans cette phase",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return false;
        }

        // Créer un bonus pour chaque manager
        const bonusInserts = rostersData.map(roster => ({
          phase_id: phaseId,
          bonus_type: bonusType,
          coureur_id: data.coureur_id,
          manager_id: roster.manager_id,
          points: data.points,
          commentaire: data.commentaire || null,
          created_by: managerData?.id,
          league_id: leagueId!
        }));

        const { error } = await supabase
          .from('bonus_points')
          .insert(bonusInserts);

        if (error) throw error;

        toast({
          title: "Bonus enregistré",
          description: `Le bonus a été attribué à ${rostersData.length} manager(s)`,
        });
      } else {
        // Pour coureur_bonuse: attribution à un seul manager
        if (!data.manager_id) {
          throw new Error("Manager ID requis pour ce type de bonus");
        }

        const { error } = await supabase
          .from('bonus_points')
          .insert([{
            phase_id: phaseId,
            bonus_type: bonusType,
            coureur_id: data.coureur_id,
            manager_id: data.manager_id,
            points: data.points,
            commentaire: data.commentaire || null,
            created_by: managerData?.id,
            league_id: leagueId!
          }]);

        if (error) throw error;

        toast({
          title: "Bonus enregistré",
          description: "Le bonus a été attribué avec succès",
        });
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['bonus-points', phaseId] });
      return true;
      
    } catch (error: any) {
      console.error('Error saving bonus:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer le bonus",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitManagerBonus = async (data: {
    target_manager_id: string;
    points: number;
    commentaire?: string;
  }) => {
    if (!selectedBonus) return;

    setIsSubmitting(true);
    try {
      // Get current user's manager_id for created_by
      const { data: { user } } = await supabase.auth.getUser();
      const { data: managerData } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      const { error } = await supabase
        .from('bonus_points')
        .insert([{
          phase_id: phaseId,
          bonus_type: selectedBonus.type,
          target_manager_id: data.target_manager_id,
          points: data.points,
          commentaire: data.commentaire || null,
          created_by: managerData?.id,
          league_id: leagueId!
        }]);

      if (error) throw error;

      toast({
        title: "Bonus enregistré",
        description: "Le bonus a été attribué avec succès",
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['bonus-points', phaseId] });
      
      // Stay on the form to allow adding more
    } catch (error: any) {
      console.error('Error saving bonus:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer le bonus",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (bonusId: string) => {
    try {
      const { error } = await supabase
        .from('bonus_points')
        .delete()
        .eq('id', bonusId);

      if (error) throw error;

      toast({
        title: "Bonus supprimé",
        description: "Le bonus a été supprimé avec succès",
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['bonus-points', phaseId] });
    } catch (error: any) {
      console.error('Error deleting bonus:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le bonus",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attribution de Points Bonus - Phase {phaseData?.index_dans_saison || '...'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'select-type' && (
            <BonusTypeSelector onSelect={handleBonusTypeSelect} />
          )}

          {step === 'enter-data' && selectedBonus && (
            <>
              {selectedBonus.category === 'coureur' ? (
                <RiderBonusForm
                  bonusType={selectedBonus.type as any}
                  phaseId={phaseId}
                  onBack={handleBack}
                  onSubmit={handleSubmitRiderBonus}
                  isSubmitting={isSubmitting}
                />
              ) : (
                <ManagerBonusForm
                  bonusType={selectedBonus.type as any}
                  onBack={handleBack}
                  onSubmit={handleSubmitManagerBonus}
                  isSubmitting={isSubmitting}
                />
              )}
            </>
          )}

          {!isLoading && bonuses.length > 0 && (
            <div className="pt-6 border-t">
              <BonusListTable
                bonuses={bonuses}
                onDelete={handleDelete}
                isDeleting={false}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

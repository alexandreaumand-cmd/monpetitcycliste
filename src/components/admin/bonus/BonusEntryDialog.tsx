import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BonusTypeSelector, type BonusType } from "./BonusTypeSelector";
import { RiderBonusForm } from "./RiderBonusForm";
import { ManagerBonusForm } from "./ManagerBonusForm";
import { BonusListTable } from "./BonusListTable";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

type FormStep = 'select-type' | 'enter-data';

interface BonusEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
}

export const BonusEntryDialog = ({ open, onOpenChange, phaseId }: BonusEntryDialogProps) => {
  const [step, setStep] = useState<FormStep>('select-type');
  const [selectedBonus, setSelectedBonus] = useState<BonusType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Fetch existing bonuses
  const { data: bonusesData, isLoading } = useQuery({
    queryKey: ['bonus-points', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-manage-bonus', {
        method: 'GET',
        body: { phase_id: phaseId }
      });

      if (error) throw error;
      return data;
    },
    enabled: open,
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
    manager_id: string;
    points: number;
    commentaire?: string;
  }) => {
    if (!selectedBonus) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('admin-manage-bonus', {
        body: {
          phase_id: phaseId,
          bonus_type: selectedBonus.type,
          coureur_id: data.coureur_id,
          manager_id: data.manager_id,
          points: data.points,
          commentaire: data.commentaire,
        }
      });

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

  const handleSubmitManagerBonus = async (data: {
    target_manager_id: string;
    points: number;
    commentaire?: string;
  }) => {
    if (!selectedBonus) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('admin-manage-bonus', {
        body: {
          phase_id: phaseId,
          bonus_type: selectedBonus.type,
          target_manager_id: data.target_manager_id,
          points: data.points,
          commentaire: data.commentaire,
        }
      });

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
      const { error } = await supabase.functions.invoke(`admin-manage-bonus/${bonusId}`, {
        method: 'DELETE'
      });

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
          <DialogTitle>Attribution de Points Bonus - Phase {phaseId.slice(0, 8)}</DialogTitle>
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

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLeague } from "@/contexts/LeagueContext";

interface BonusRiderSelectorProps {
  coureur_id: string;
  coureur_nom: string;
  cote_initiale: number;
  phase_id: string;
  manager_id: string;
  isSelected: boolean;
  canSelect: boolean;
}

export const BonusRiderSelector = ({
  coureur_id,
  coureur_nom,
  cote_initiale,
  phase_id,
  manager_id,
  isSelected,
  canSelect,
}: BonusRiderSelectorProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();

  const selectBonusRider = useMutation({
    mutationFn: async () => {
      // Vérifier éligibilité (cote initiale = 10 ou 20)
      if (cote_initiale !== 10 && cote_initiale !== 20) {
        throw new Error('Seuls les coureurs avec une cote initiale de 10 ou 20 sont éligibles');
      }

      // Vérifier qu'aucun coureur bonus n'est déjà sélectionné
      const { data: existing } = await supabase
        .from('bonus_rider_selections')
        .select('id')
        .match({
          manager_id,
          phase_id,
          league_id: leagueId || 'f7921741-29f4-4296-9aca-a03c1f3615b0'
        })
        .maybeSingle();

      if (existing) {
        throw new Error('Vous avez déjà sélectionné un coureur bonus pour cette phase');
      }

      // Insérer la sélection
      const { error } = await supabase
        .from('bonus_rider_selections')
        .insert({
          manager_id,
          phase_id,
          coureur_id,
          league_id: leagueId || 'f7921741-29f4-4296-9aca-a03c1f3615b0',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Coureur bonus sélectionné !",
        description: "Ce coureur recevra désormais +25% de points bonus sur ses résultats.",
      });
      queryClient.invalidateQueries({ queryKey: ['myTeam'] });
      queryClient.invalidateQueries({ queryKey: ['bonusRiderSelection'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isSelected) {
    return (
      <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 text-white gap-1">
        <Star className="h-3 w-3 fill-white" />
        Coureur Bonus +25%
      </Badge>
    );
  }

  if (!canSelect) return null;
  if (cote_initiale !== 10 && cote_initiale !== 20) return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Star className="h-4 w-4" />
          Désigner comme coureur bonus
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Désigner {coureur_nom} comme coureur bonus ?</AlertDialogTitle>
          <AlertDialogDescription>
            Ce coureur recevra automatiquement +25% de points bonus sur tous ses résultats de courses.
            <br /><br />
            ⚠️ <strong>Attention :</strong> Ce choix est <strong>définitif pour cette phase</strong>. Vous ne pourrez pas changer de coureur bonus.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => selectBonusRider.mutate()}>
            Confirmer la sélection
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ManagerBonusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
}

interface BonusEntry {
  manager_id: string;
  manager_nom: string;
  race_points: number;
  current_bonus: number;
  new_bonus: number;
  commentaire: string;
}

export const ManagerBonusDialog = ({ open, onOpenChange, phaseId }: ManagerBonusDialogProps) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [bonuses, setBonuses] = useState<Map<string, BonusEntry>>(new Map());

  // Fetch managers with their current points and bonuses
  const { data: managers, isLoading } = useQuery({
    queryKey: ['managers-bonus', phaseId],
    queryFn: async () => {
      // Get managers standings for this phase
      const { data: standings, error: standingsError } = await supabase
        .from('v_manager_standings_by_phase')
        .select('manager_id, manager_nom, race_points, bonus_points')
        .eq('phase_id', phaseId)
        .order('manager_nom');

      if (standingsError) throw standingsError;

      // Get existing bonus comments
      const { data: bonusData, error: bonusError } = await supabase
        .from('manager_bonus_points')
        .select('manager_id, points, commentaire')
        .eq('phase_id', phaseId);

      if (bonusError) throw bonusError;

      const bonusMap = new Map(bonusData?.map(b => [b.manager_id, b]) || []);

      return standings?.map(s => ({
        manager_id: s.manager_id,
        manager_nom: s.manager_nom,
        race_points: s.race_points || 0,
        current_bonus: s.bonus_points || 0,
        new_bonus: s.bonus_points || 0,
        commentaire: bonusMap.get(s.manager_id)?.commentaire || ''
      })) || [];
    },
    enabled: open
  });

  // Initialize bonuses map when data loads
  if (managers && bonuses.size === 0) {
    const map = new Map<string, BonusEntry>();
    managers.forEach(m => map.set(m.manager_id, m));
    setBonuses(map);
  }

  const updateBonus = (managerId: string, field: 'new_bonus' | 'commentaire', value: string | number) => {
    setBonuses(prev => {
      const newMap = new Map(prev);
      const entry = newMap.get(managerId);
      if (entry) {
        newMap.set(managerId, { ...entry, [field]: value });
      }
      return newMap;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const changedBonuses = Array.from(bonuses.values())
        .filter(b => b.new_bonus !== b.current_bonus || b.commentaire)
        .map(b => ({
          manager_id: b.manager_id,
          points: Number(b.new_bonus),
          commentaire: b.commentaire || null
        }));

      if (changedBonuses.length === 0) {
        toast.info("Aucune modification à enregistrer");
        return;
      }

      const { error } = await supabase.functions.invoke('admin-save-bonus-points', {
        body: {
          phase_id: phaseId,
          bonuses: changedBonuses
        }
      });

      if (error) throw error;

      toast.success(`${changedBonuses.length} bonus enregistré(s)`);
      queryClient.invalidateQueries({ queryKey: ['managers-bonus'] });
      queryClient.invalidateQueries({ queryKey: ['manager-standings'] });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving bonuses:', error);
      toast.error("Erreur lors de l'enregistrement des bonus");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attribution de Points Bonus</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium">Manager</th>
                    <th className="p-3 text-right font-medium">Points Courses</th>
                    <th className="p-3 text-right font-medium">Bonus Actuel</th>
                    <th className="p-3 text-right font-medium w-24">Nouveau Bonus</th>
                    <th className="p-3 text-left font-medium">Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {managers?.map((manager) => {
                    const bonus = bonuses.get(manager.manager_id) || manager;
                    return (
                      <tr key={manager.manager_id} className="border-t">
                        <td className="p-3">{manager.manager_nom}</td>
                        <td className="p-3 text-right text-muted-foreground">
                          {manager.race_points}
                        </td>
                        <td className="p-3 text-right">
                          {manager.current_bonus > 0 ? (
                            <span className="text-green-600">+{manager.current_bonus}</span>
                          ) : manager.current_bonus < 0 ? (
                            <span className="text-red-600">{manager.current_bonus}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={bonus.new_bonus}
                            onChange={(e) => updateBonus(manager.manager_id, 'new_bonus', e.target.value)}
                            className="w-20 text-right"
                          />
                        </td>
                        <td className="p-3">
                          <Textarea
                            value={bonus.commentaire}
                            onChange={(e) => updateBonus(manager.manager_id, 'commentaire', e.target.value)}
                            placeholder="Raison du bonus/malus..."
                            className="min-h-[60px] resize-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

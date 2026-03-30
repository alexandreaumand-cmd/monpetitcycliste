import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
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
  course_points: number;
  bonus_itt: number;
  bonus_ttt: number;
  bonus_first_win: number;
  bonus_coureur: number;
  bonus_scoreurs: number;
  commentaire: string;
}

export const ManagerBonusDialog = ({ open, onOpenChange, phaseId }: ManagerBonusDialogProps) => {
  const { leagueId } = useLeague();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [bonuses, setBonuses] = useState<Map<string, BonusEntry>>(new Map());

  // Fetch managers with their current points and bonuses
  const { data: managers, isLoading } = useQuery({
    queryKey: ['managers-bonus', phaseId, leagueId],
    queryFn: async () => {
      // Get managers standings for this phase
      const { data: standings, error: standingsError } = await supabase
        .from('v_manager_standings_by_phase_v2')
        .select('manager_id, total_race_pts, manager_bonus, rider_bonus, league_id')
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId);

      if (standingsError) throw standingsError;
      if (!standings) return [];

      // Get manager names
      const managerIds = standings.map(s => s.manager_id);
      const { data: managersData, error: managersError } = await supabase
        .from('managers')
        .select('id, nom')
        .in('id', managerIds);

      if (managersError) throw managersError;

      const managerMap = new Map(managersData?.map(m => [m.id, m.nom]) || []);

      // Get existing bonus details
      const { data: bonusData, error: bonusError } = await supabase
        .from('manager_bonus_points')
        .select('manager_id, bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs, commentaire')
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId);

      if (bonusError) throw bonusError;

      const bonusMap = new Map(bonusData?.map(b => [b.manager_id, b]) || []);

      return standings
        ?.sort((a, b) => {
          const nomA = managerMap.get(a.manager_id) || '';
          const nomB = managerMap.get(b.manager_id) || '';
          return nomA.localeCompare(nomB);
        })
        .map(s => {
          const existingBonus = bonusMap.get(s.manager_id);
          const managerNom = managerMap.get(s.manager_id) || 'Unknown';
          return {
            manager_id: s.manager_id,
            manager_nom: managerNom || 'Unknown',
            course_points: s.total_race_pts || 0,
            bonus_itt: existingBonus?.bonus_itt || 0,
            bonus_ttt: existingBonus?.bonus_ttt || 0,
            bonus_first_win: existingBonus?.bonus_first_win || 0,
            bonus_coureur: existingBonus?.bonus_coureurs || 0,
            bonus_scoreurs: existingBonus?.bonus_scoreurs || 0,
            commentaire: existingBonus?.commentaire || ''
          };
        }) || [];
    },
    enabled: open
  });

  // Initialize bonuses map when data loads
  if (managers && bonuses.size === 0) {
    const map = new Map<string, BonusEntry>();
    managers.forEach(m => map.set(m.manager_id, m));
    setBonuses(map);
  }

  const updateBonus = (managerId: string, field: keyof BonusEntry, value: string | number) => {
    setBonuses(prev => {
      const newMap = new Map(prev);
      const entry = newMap.get(managerId);
      if (entry) {
        newMap.set(managerId, { ...entry, [field]: value });
      }
      return newMap;
    });
  };

  const calculateTotal = (entry: BonusEntry) => {
    return entry.bonus_itt + entry.bonus_ttt + entry.bonus_first_win + entry.bonus_coureur + entry.bonus_scoreurs;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const changedBonuses = Array.from(bonuses.values())
        .map(b => ({
          manager_id: b.manager_id,
          bonus_itt: Number(b.bonus_itt),
          bonus_ttt: Number(b.bonus_ttt),
          bonus_first_win: Number(b.bonus_first_win),
          bonus_coureur: Number(b.bonus_coureur),
          bonus_scoreurs: Number(b.bonus_scoreurs),
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

      // Refresh materialized standings views
      await supabase.rpc("refresh_standings_views").then(({ error: refreshErr }) => {
        if (refreshErr) console.error('Failed to refresh standings views:', refreshErr);
      });

      toast.success(`${changedBonuses.length} bonus enregistré(s)`);
      queryClient.invalidateQueries({ queryKey: ['managers-bonus'] });
      queryClient.invalidateQueries({ queryKey: ['manager-standings'] });
      queryClient.invalidateQueries({ queryKey: ['league-standings-season'] });
      queryClient.invalidateQueries({ queryKey: ['league-standings-phase'] });
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
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attribution de Points Bonus</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium whitespace-nowrap">Manager</th>
                    <th className="p-3 text-right font-medium whitespace-nowrap">Points Courses</th>
                    <th className="p-3 text-center font-medium whitespace-nowrap w-20">ITT</th>
                    <th className="p-3 text-center font-medium whitespace-nowrap w-20">TTT</th>
                    <th className="p-3 text-center font-medium whitespace-nowrap w-24">First Win</th>
                    <th className="p-3 text-center font-medium whitespace-nowrap w-24">Coureur</th>
                    <th className="p-3 text-center font-medium whitespace-nowrap w-24">Scoreurs</th>
                    <th className="p-3 text-right font-medium whitespace-nowrap w-24">Total Bonus</th>
                    <th className="p-3 text-left font-medium">Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {managers?.map((manager) => {
                    const bonus = bonuses.get(manager.manager_id) || manager;
                    const total = calculateTotal(bonus);
                    return (
                      <tr key={manager.manager_id} className="border-t">
                        <td className="p-3 whitespace-nowrap">{manager.manager_nom}</td>
                        <td className="p-3 text-right text-muted-foreground">
                          {manager.course_points}
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={bonus.bonus_itt}
                            onChange={(e) => updateBonus(manager.manager_id, 'bonus_itt', Number(e.target.value))}
                            className="w-16 text-center text-sm"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={bonus.bonus_ttt}
                            onChange={(e) => updateBonus(manager.manager_id, 'bonus_ttt', Number(e.target.value))}
                            className="w-16 text-center text-sm"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={bonus.bonus_first_win}
                            onChange={(e) => updateBonus(manager.manager_id, 'bonus_first_win', Number(e.target.value))}
                            className="w-20 text-center text-sm"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={bonus.bonus_coureur}
                            onChange={(e) => updateBonus(manager.manager_id, 'bonus_coureur', Number(e.target.value))}
                            className="w-20 text-center text-sm"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={bonus.bonus_scoreurs}
                            onChange={(e) => updateBonus(manager.manager_id, 'bonus_scoreurs', Number(e.target.value))}
                            className="w-20 text-center text-sm"
                          />
                        </td>
                        <td className="p-3 text-right font-medium">
                          {total > 0 ? (
                            <span className="text-green-600">+{total}</span>
                          ) : total < 0 ? (
                            <span className="text-red-600">{total}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Textarea
                            value={bonus.commentaire}
                            onChange={(e) => updateBonus(manager.manager_id, 'commentaire', e.target.value)}
                            placeholder="Notes..."
                            className="min-h-[50px] resize-none text-sm"
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

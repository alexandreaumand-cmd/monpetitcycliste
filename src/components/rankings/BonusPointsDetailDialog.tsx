import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Users, Trophy } from "lucide-react";

interface BonusPointsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managerId: string;
  managerName: string;
  phaseId: string | null;
}

export const BonusPointsDetailDialog = ({
  open,
  onOpenChange,
  managerId,
  managerName,
  phaseId,
}: BonusPointsDetailDialogProps) => {
  // Fetch rider bonus points
  const { data: riderBonuses, isLoading: loadingRiderBonuses } = useQuery({
    queryKey: ["bonus-points-detail", managerId, phaseId],
    queryFn: async () => {
      let query = supabase
        .from("bonus_points")
        .select(`
          id,
          points,
          commentaire,
          bonus_type,
          coureur_id,
          phase_id,
          coureurs(nom, equipe),
          phases(index_dans_saison)
        `)
        .eq("manager_id", managerId)
        .order("phase_id", { ascending: true });

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch manual bonus points
  const { data: manualBonuses, isLoading: loadingManualBonuses } = useQuery({
    queryKey: ["manager-bonus-points-detail", managerId, phaseId],
    queryFn: async () => {
      let query = supabase
        .from("manager_bonus_points")
        .select(`
          id,
          bonus_first_win,
          bonus_coureurs,
          bonus_scoreurs,
          bonus_itt,
          bonus_ttt,
          commentaire,
          phase_id,
          phases(index_dans_saison)
        `)
        .eq("manager_id", managerId)
        .order("phase_id", { ascending: true });

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const isLoading = loadingRiderBonuses || loadingManualBonuses;

  // Calculate totals
  const riderBonusTotal = riderBonuses?.reduce((sum, b) => sum + b.points, 0) || 0;
  const manualBonusTotal = manualBonuses?.reduce((sum, b) => 
    sum + b.bonus_first_win + b.bonus_coureurs + b.bonus_scoreurs + b.bonus_itt + b.bonus_ttt, 0
  ) || 0;
  const totalBonus = riderBonusTotal + manualBonusTotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Détail des points bonus - {managerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              {/* Rider bonuses */}
              {riderBonuses && riderBonuses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-4 w-4" />
                      Bonus coureurs (+25%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {!phaseId && <TableHead>Phase</TableHead>}
                          <TableHead>Coureur</TableHead>
                          <TableHead>Équipe</TableHead>
                          <TableHead>Détail</TableHead>
                          <TableHead className="text-right">Points</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {riderBonuses.map((bonus) => (
                          <TableRow key={bonus.id}>
                            {!phaseId && (
                              <TableCell className="font-medium">
                                P{bonus.phases?.index_dans_saison}
                              </TableCell>
                            )}
                            <TableCell className="font-medium">
                              {bonus.coureurs?.nom}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {bonus.coureurs?.equipe}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                              {bonus.commentaire}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium text-green-600">
                              +{bonus.points}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <span className="text-sm font-medium">Sous-total coureurs</span>
                      <span className="font-mono font-bold text-green-600">+{riderBonusTotal}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Manual bonuses */}
              {manualBonuses && manualBonuses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Award className="h-4 w-4" />
                      Bonus manuels
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {manualBonuses.map((bonus) => {
                        const phaseTotal = bonus.bonus_first_win + bonus.bonus_coureurs + 
                                         bonus.bonus_scoreurs + bonus.bonus_itt + bonus.bonus_ttt;
                        
                        if (phaseTotal === 0) return null;

                        return (
                          <div key={bonus.id} className="border rounded-lg p-4 space-y-2">
                            {!phaseId && (
                              <div className="font-semibold text-sm">
                                Phase {bonus.phases?.index_dans_saison}
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {bonus.bonus_first_win !== 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Première victoire</span>
                                  <span className="font-mono font-medium text-green-600">
                                    +{bonus.bonus_first_win}
                                  </span>
                                </div>
                              )}
                              {bonus.bonus_coureurs !== 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Bonus coureurs</span>
                                  <span className="font-mono font-medium text-green-600">
                                    +{bonus.bonus_coureurs}
                                  </span>
                                </div>
                              )}
                              {bonus.bonus_scoreurs !== 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Bonus scoreurs</span>
                                  <span className="font-mono font-medium text-green-600">
                                    +{bonus.bonus_scoreurs}
                                  </span>
                                </div>
                              )}
                              {bonus.bonus_itt !== 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Bonus ITT</span>
                                  <span className="font-mono font-medium text-green-600">
                                    +{bonus.bonus_itt}
                                  </span>
                                </div>
                              )}
                              {bonus.bonus_ttt !== 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Bonus TTT</span>
                                  <span className="font-mono font-medium text-green-600">
                                    +{bonus.bonus_ttt}
                                  </span>
                                </div>
                              )}
                            </div>
                            {bonus.commentaire && (
                              <div className="text-sm text-muted-foreground italic pt-2 border-t">
                                {bonus.commentaire}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <span className="text-sm font-medium">Sous-total manuels</span>
                      <span className="font-mono font-bold text-green-600">+{manualBonusTotal}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state */}
              {(!riderBonuses || riderBonuses.length === 0) && 
               (!manualBonuses || manualBonuses.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun bonus pour cette période
                </div>
              )}

              {/* Total */}
              {totalBonus > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 flex justify-between items-center">
                  <span className="font-semibold">Total des bonus</span>
                  <span className="text-2xl font-mono font-bold text-green-600">
                    +{totalBonus} pts
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

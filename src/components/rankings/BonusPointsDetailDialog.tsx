import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Award, Users, Trophy, Clock, Zap, ChevronDown, ChevronUp } from "lucide-react";

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
  // État pour gérer l'expansion des sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    coureur_bonuse: false,  // collapsed par défaut
    scoreurs: false,  // collapsed par défaut
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Fetch all bonus points
  const { data: allBonuses, isLoading } = useQuery({
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
          coureurs!inner(id, nom),
          phases!inner(index_dans_saison, saison_id)
        `)
        .or(`manager_id.eq.${managerId},target_manager_id.eq.${managerId}`)
        .order("phase_id", { ascending: true });

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrichir avec l'équipe de la saison
      const enrichedData = await Promise.all(
        (data || []).map(async (bonus) => {
          if (!bonus.coureur_id) return { ...bonus, coureur_equipe: null };

          const { data: seasonData } = await supabase
            .from('coureurs_saisons')
            .select('equipe')
            .eq('coureur_id', bonus.coureur_id)
            .eq('saison_id', bonus.phases.saison_id)
            .maybeSingle();

          return {
            ...bonus,
            coureur_equipe: seasonData?.equipe || 'N/A'
          };
        })
      );

      return enrichedData;
    },
    enabled: open,
  });

  // Fetch manager bonus points
  const { data: managerBonuses } = useQuery({
    queryKey: ["manager-bonus-points", managerId, phaseId],
    queryFn: async () => {
      let query = supabase
        .from("manager_bonus_points")
        .select(`
          id,
          phase_id,
          bonus_itt,
          bonus_ttt,
          bonus_first_win,
          bonus_coureurs,
          bonus_scoreurs,
          commentaire,
          phases!inner(index_dans_saison)
        `)
        .eq("manager_id", managerId);
      
      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Group bonuses by type
  const bonusesByType = useMemo(() => {
    if (!allBonuses) return {};
    
    return allBonuses.reduce((acc, bonus) => {
      const type = bonus.bonus_type || 'other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(bonus);
      return acc;
    }, {} as Record<string, typeof allBonuses>);
  }, [allBonuses]);

  // Calculate totals by type
  const totalsByType = useMemo(() => {
    return Object.entries(bonusesByType).reduce((acc, [type, bonuses]) => {
      acc[type] = bonuses.reduce((sum, b) => sum + (b.points || 0), 0);
      return acc;
    }, {} as Record<string, number>);
  }, [bonusesByType]);

  // Calculate manager bonus total
  const managerBonusTotal = useMemo(() => {
    if (!managerBonuses) return 0;
    return managerBonuses.reduce((sum, mb) => 
      sum + (mb.bonus_itt || 0) + (mb.bonus_ttt || 0) + 
      (mb.bonus_first_win || 0) + (mb.bonus_coureurs || 0) + 
      (mb.bonus_scoreurs || 0), 0
    );
  }, [managerBonuses]);

  // Grand total
  const grandTotal = Object.values(totalsByType).reduce((sum, val) => sum + val, 0) + managerBonusTotal;

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
              {/* Bonus managers */}
              {managerBonuses && managerBonuses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Bonus managers
                      </span>
                      <span className="text-green-600 font-mono">+{managerBonusTotal} pts</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {!phaseId && <TableHead>Phase</TableHead>}
                          <TableHead className="text-center">ITT</TableHead>
                          <TableHead className="text-center">TTT</TableHead>
                          <TableHead className="text-center">1ère Victoire</TableHead>
                          <TableHead className="text-center">Coureurs</TableHead>
                          <TableHead className="text-center">Scoreurs</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {managerBonuses.map((mb) => {
                          const rowTotal = (mb.bonus_itt || 0) + (mb.bonus_ttt || 0) + 
                                          (mb.bonus_first_win || 0) + (mb.bonus_coureurs || 0) + 
                                          (mb.bonus_scoreurs || 0);
                          return (
                            <TableRow key={mb.id}>
                              {!phaseId && (
                                <TableCell className="font-medium">
                                  P{mb.phases?.index_dans_saison}
                                </TableCell>
                              )}
                              <TableCell className="text-center">{mb.bonus_itt || 0}</TableCell>
                              <TableCell className="text-center">{mb.bonus_ttt || 0}</TableCell>
                              <TableCell className="text-center">{mb.bonus_first_win || 0}</TableCell>
                              <TableCell className="text-center">{mb.bonus_coureurs || 0}</TableCell>
                              <TableCell className="text-center">{mb.bonus_scoreurs || 0}</TableCell>
                              <TableCell className="text-right font-mono font-medium text-green-600">
                                +{rowTotal}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {managerBonuses.some(mb => mb.commentaire) && (
                      <div className="mt-4 text-sm text-muted-foreground italic">
                        {managerBonuses.find(mb => mb.commentaire)?.commentaire}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Bonus coureurs (+25%) */}
              {bonusesByType['coureur_bonuse']?.length > 0 && (
                <Card>
                  <CardHeader 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleSection('coureur_bonuse')}
                  >
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Bonus coureurs (+25%)
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-600 font-mono">+{totalsByType['coureur_bonuse']} pts</span>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          {expandedSections['coureur_bonuse'] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  
                  {expandedSections['coureur_bonuse'] && (
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
                          {bonusesByType['coureur_bonuse'].map((bonus) => (
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
                                {bonus.coureur_equipe}
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
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Bonus TTT */}
              {bonusesByType['ttt']?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Bonus Contre-la-Montre par équipe
                      </span>
                      <span className="text-green-600 font-mono">+{totalsByType['ttt']} pts</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {bonusesByType['ttt'].map((bonus) => (
                        <div key={bonus.id} className="flex justify-between items-start border-b pb-2 last:border-0">
                          <div className="flex-1">
                            {!phaseId && (
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                Phase {bonus.phases?.index_dans_saison}
                              </div>
                            )}
                            {bonus.coureur_id && (
                              <>
                                <div className="font-medium">
                                  {bonus.coureurs?.nom}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {bonus.coureur_equipe}
                                </div>
                              </>
                            )}
                            {bonus.commentaire && (
                              <div className="text-sm text-muted-foreground mt-1 italic">
                                {bonus.commentaire}
                              </div>
                            )}
                          </div>
                          <span className="font-mono font-medium text-green-600 ml-4">
                            +{bonus.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bonus scoreurs */}
              {bonusesByType['scoreurs']?.length > 0 && (
                <Card>
                  <CardHeader 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleSection('scoreurs')}
                  >
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Bonus scoreurs
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-600 font-mono">+{totalsByType['scoreurs']} pts</span>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          {expandedSections['scoreurs'] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  
                  {expandedSections['scoreurs'] && (
                    <CardContent>
                      <div className="space-y-2">
                        {bonusesByType['scoreurs'].map((bonus) => (
                          <div key={bonus.id} className="flex justify-between items-start border-b pb-2 last:border-0">
                            <div className="flex-1">
                              {!phaseId && (
                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                  Phase {bonus.phases?.index_dans_saison}
                                </div>
                              )}
                              {bonus.coureur_id && (
                                <>
                                  <div className="font-medium">
                                    {bonus.coureurs?.nom}
                                  </div>
                                <div className="text-sm text-muted-foreground">
                                  {bonus.coureur_equipe}
                                </div>
                                </>
                              )}
                              {bonus.commentaire && (
                                <div className="text-sm text-muted-foreground mt-1 italic">
                                  {bonus.commentaire}
                                </div>
                              )}
                            </div>
                            <span className="font-mono font-medium text-green-600 ml-4">
                              +{bonus.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Bonus première victoire */}
              {bonusesByType['first_win']?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        Bonus première victoire
                      </span>
                      <span className="text-green-600 font-mono">+{totalsByType['first_win']} pts</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {bonusesByType['first_win'].map((bonus) => (
                        <div key={bonus.id} className="flex justify-between items-start border-b pb-2 last:border-0">
                          <div className="flex-1">
                            {!phaseId && (
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                Phase {bonus.phases?.index_dans_saison}
                              </div>
                            )}
                            {bonus.coureur_id && (
                              <>
                                <div className="font-medium">
                                  {bonus.coureurs?.nom}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {bonus.coureur_equipe}
                                </div>
                              </>
                            )}
                            {bonus.commentaire && (
                              <div className="text-sm text-muted-foreground mt-1 italic">
                                {bonus.commentaire}
                              </div>
                            )}
                          </div>
                          <span className="font-mono font-medium text-green-600 ml-4">
                            +{bonus.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state */}
              {Object.keys(bonusesByType).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun bonus pour cette période
                </div>
              )}

              {/* Grand total */}
              {grandTotal > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 flex justify-between items-center">
                  <span className="font-semibold text-lg">Total des bonus</span>
                  <span className="text-2xl font-mono font-bold text-green-600">
                    +{grandTotal} pts
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

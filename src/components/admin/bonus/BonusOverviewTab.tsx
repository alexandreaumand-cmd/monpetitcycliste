import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Users, Star, Timer, Target } from "lucide-react";

interface BonusOverviewTabProps {
  phaseId: string;
  leagueId?: string;
  saisonId: string;
}

interface ManagerBonusSummary {
  manager_id: string;
  manager_nom: string;
  league_name: string | null;
  phase_index: number | null;
  first_win: number;
  coureur_bonuse: number;
  itt: number;
  ttt: number;
  scoreurs: number;
  total: number;
}

export const BonusOverviewTab = ({ phaseId, leagueId, saisonId }: BonusOverviewTabProps) => {
  // Fetch bonus_points (rider bonuses)
  const { data: riderBonuses, isLoading: loadingRider } = useQuery({
    queryKey: ["bonus-points-overview", phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_points")
        .select(`
          id,
          bonus_type,
          points,
          manager_id,
          target_manager_id,
          phase_id,
          manager:managers!bonus_points_manager_id_fkey(id, nom),
          phase:phases!bonus_points_phase_id_fkey(id, index_dans_saison)
        `)
        .eq("phase_id", phaseId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!phaseId,
  });

  // Fetch manager_bonus_points (manager bonuses like TTT, scoreurs)
  const { data: managerBonuses, isLoading: loadingManager } = useQuery({
    queryKey: ["manager-bonus-points-overview", phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("manager_bonus_points")
        .select(`
          id,
          manager_id,
          bonus_ttt,
          bonus_scoreurs,
          bonus_coureurs,
          bonus_first_win,
          bonus_itt,
          league_id,
          phase_id,
          manager:managers!manager_bonus_points_manager_id_fkey(id, nom),
          league:leagues!fk_manager_bonus_points_league(id, name),
          phase:phases!manager_bonus_points_phase_id_fkey(id, index_dans_saison)
        `)
        .eq("phase_id", phaseId);

      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!phaseId,
  });

  // Aggregate by manager
  const summaryByManager = (): ManagerBonusSummary[] => {
    const managerMap = new Map<string, ManagerBonusSummary>();

    // Process rider bonuses (bonus_points table)
    riderBonuses?.forEach((bonus) => {
      const managerId = bonus.manager_id;
      if (!managerId) return;

      const managerName = (bonus.manager as any)?.nom || 'Inconnu';
      const phaseIndex = (bonus.phase as any)?.index_dans_saison || null;
      const key = managerId;

      if (!managerMap.has(key)) {
        managerMap.set(key, {
          manager_id: managerId,
          manager_nom: managerName,
          league_name: null,
          phase_index: phaseIndex,
          first_win: 0,
          coureur_bonuse: 0,
          itt: 0,
          ttt: 0,
          scoreurs: 0,
          total: 0,
        });
      }

      const entry = managerMap.get(key)!;
      if (!entry.phase_index && phaseIndex) entry.phase_index = phaseIndex;
      
      switch (bonus.bonus_type) {
        case 'first_win':
          entry.first_win += bonus.points;
          break;
        case 'coureur_bonuse':
          entry.coureur_bonuse += bonus.points;
          break;
        case 'itt':
          entry.itt += bonus.points;
          break;
        case 'ttt':
          entry.ttt += bonus.points;
          break;
        case 'scoreurs':
          entry.scoreurs += bonus.points;
          break;
      }
      entry.total += bonus.points;
    });

    // Process manager bonuses (manager_bonus_points table)
    managerBonuses?.forEach((bonus) => {
      const managerId = bonus.manager_id;
      const managerName = (bonus.manager as any)?.nom || 'Inconnu';
      const leagueName = (bonus.league as any)?.name || null;
      const phaseIndex = (bonus.phase as any)?.index_dans_saison || null;
      const key = `${managerId}-${bonus.league_id || 'global'}`;

      if (!managerMap.has(key)) {
        managerMap.set(key, {
          manager_id: managerId,
          manager_nom: managerName,
          league_name: leagueName,
          phase_index: phaseIndex,
          first_win: 0,
          coureur_bonuse: 0,
          itt: 0,
          ttt: 0,
          scoreurs: 0,
          total: 0,
        });
      }

      const entry = managerMap.get(key)!;
      entry.league_name = leagueName;
      if (!entry.phase_index && phaseIndex) entry.phase_index = phaseIndex;
      entry.ttt += bonus.bonus_ttt || 0;
      entry.scoreurs += bonus.bonus_scoreurs || 0;
      entry.coureur_bonuse += bonus.bonus_coureurs || 0;
      entry.first_win += bonus.bonus_first_win || 0;
      entry.itt += bonus.bonus_itt || 0;
      entry.total += (bonus.bonus_ttt || 0) + (bonus.bonus_scoreurs || 0) + 
                     (bonus.bonus_coureurs || 0) + (bonus.bonus_first_win || 0) + 
                     (bonus.bonus_itt || 0);
    });

    return Array.from(managerMap.values())
      .filter(m => m.total > 0)
      .sort((a, b) => b.total - a.total);
  };

  const summary = summaryByManager();
  const isLoading = loadingRider || loadingManager;

  // Stats
  const totalPoints = summary.reduce((acc, m) => acc + m.total, 0);
  const totalFirstWin = summary.reduce((acc, m) => acc + m.first_win, 0);
  const totalItt = summary.reduce((acc, m) => acc + m.itt, 0);
  const totalTtt = summary.reduce((acc, m) => acc + m.ttt, 0);
  const totalScoreurs = summary.reduce((acc, m) => acc + m.scoreurs, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-bordure-gold" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{totalPoints}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">First Win</span>
            </div>
            <p className="text-2xl font-bold">{totalFirstWin}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">ITT</span>
            </div>
            <p className="text-2xl font-bold">{totalItt}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">TTT</span>
            </div>
            <p className="text-2xl font-bold">{totalTtt}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Scoreurs</span>
            </div>
            <p className="text-2xl font-bold">{totalScoreurs}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Récapitulatif par Manager</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun bonus attribué pour cette phase
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manager</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Ligue</TableHead>
                    <TableHead className="text-center">First Win</TableHead>
                    <TableHead className="text-center">Coureur Bonusé</TableHead>
                    <TableHead className="text-center">ITT</TableHead>
                    <TableHead className="text-center">TTT</TableHead>
                    <TableHead className="text-center">Scoreurs</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((row, idx) => (
                    <TableRow key={`${row.manager_id}-${idx}`}>
                      <TableCell className="font-medium">{row.manager_nom}</TableCell>
                      <TableCell>
                        {row.phase_index ? (
                          <Badge variant="outline">Phase {row.phase_index}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.league_name ? (
                          <Badge variant="outline">{row.league_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.first_win > 0 && <Badge variant="secondary">{row.first_win}</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.coureur_bonuse > 0 && <Badge variant="secondary">{row.coureur_bonuse}</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.itt > 0 && <Badge variant="secondary">{row.itt}</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.ttt > 0 && <Badge variant="secondary">{row.ttt}</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.scoreurs > 0 && <Badge variant="secondary">{row.scoreurs}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge>{row.total}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

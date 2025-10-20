import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ManagerNameWithJersey } from "./ManagerNameWithJersey";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeague } from "@/contexts/LeagueContext";

interface ManagerHistoryProps {
  phaseId?: string | null;
  saisonId?: string | null;
}

export function ManagerHistory({ phaseId, saisonId }: ManagerHistoryProps) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const { leagueId, isLoading: leagueLoading } = useLeague();

  // Récupérer tous les managers
  const { data: managers } = useQuery({
    queryKey: ["all-managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select("id, nom")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // Récupérer les phase_ids si saison_id est fourni
  const { data: phaseIds } = useQuery({
    queryKey: ["season-phases", saisonId],
    queryFn: async () => {
      if (!saisonId) return null;
      const { data, error } = await supabase
        .from("phases")
        .select("id")
        .eq("saison_id", saisonId);
      
      if (error) throw error;
      return data?.map(p => p.id) || [];
    },
    enabled: !!saisonId && !phaseId,
  });

  // Récupérer tous les bids avec informations enrichies
  const { data: bids, isLoading: bidsLoading } = useQuery({
    queryKey: ["manager-bids-history", phaseId, phaseIds, selectedManager, selectedRound, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("bids")
        .select(`
          id,
          auction_id,
          manager_id,
          coureur_id,
          montant,
          statut,
          round_number,
          created_at,
          coureurs!inner(nom, equipe),
          managers!inner(nom),
          auctions!inner(phase_id, deadline_at)
        `)
        .order("created_at", { ascending: false });

      // Filtrer par phase
      if (phaseId) {
        query = query.eq("auctions.phase_id", phaseId);
      } else if (phaseIds && phaseIds.length > 0) {
        query = query.in("auctions.phase_id", phaseIds);
      }

      // Filtrer par league_id
      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }

      // Filtrer par manager
      if (selectedManager && selectedManager !== "all") {
        query = query.eq("manager_id", selectedManager);
      }

      // Filtrer par round
      if (selectedRound && selectedRound !== "all") {
        query = query.eq("round_number", parseInt(selectedRound));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !leagueLoading && !!leagueId,
  });

  // Récupérer les annonces pour identifier les gagnants
  const { data: annonces } = useQuery({
    queryKey: ["bid-winners", phaseId, phaseIds],
    queryFn: async () => {
      let query = supabase
        .from("annonces")
        .select(`
          coureur_id,
          winning_manager_id,
          winning_amount,
          round_number,
          auction_id,
          managers!inner(nom)
        `);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!bids && bids.length > 0,
  });

  // Récupérer les points des coureurs
  const { data: pointsData } = useQuery({
    queryKey: ["rider-points-for-bids", phaseId, phaseIds, bids],
    queryFn: async () => {
      if (!bids || bids.length === 0) return new Map();

      const coureurIds = [...new Set(bids.map(b => b.coureur_id))];
      
      let query = supabase
        .from("points_ledger")
        .select("coureur_id, manager_id, phase_id, points")
        .in("coureur_id", coureurIds);

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (phaseIds && phaseIds.length > 0) {
        query = query.in("phase_id", phaseIds);
      }
      
      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agréger les points par coureur et manager
      const aggregated = new Map<string, number>();
      data?.forEach(row => {
        const key = `${row.coureur_id}_${row.manager_id}`;
        const current = aggregated.get(key) || 0;
        aggregated.set(key, current + (row.points || 0));
      });

      return aggregated;
    },
    enabled: !!bids && bids.length > 0,
  });

  // Enrichir les bids avec les données
  const enrichedBids = useMemo(() => {
    if (!bids || !annonces || !pointsData) return [];

    return bids.map(bid => {
      const annonce = annonces.find(
        a => a.coureur_id === bid.coureur_id && a.round_number === bid.round_number
      );

      const pointsKey = `${bid.coureur_id}_${bid.manager_id}`;
      const totalPoints = pointsData.get(pointsKey) || 0;

      const roi = bid.statut === 'won' && bid.montant > 0
        ? totalPoints / bid.montant
        : null;

      return {
        ...bid,
        winner_name: annonce?.managers?.nom || null,
        winning_amount: annonce?.winning_amount || null,
        total_points: totalPoints,
        roi: roi,
      };
    });
  }, [bids, annonces, pointsData]);

  // Calculer les best picks et flops
  const wonBids = useMemo(() => 
    enrichedBids.filter(b => b.statut === 'won' && b.roi !== null),
    [enrichedBids]
  );

  const bestPicks = useMemo(() => 
    wonBids
      .filter(b => b.roi && b.roi >= 1)
      .sort((a, b) => (b.roi || 0) - (a.roi || 0))
      .slice(0, 5),
    [wonBids]
  );

  const flops = useMemo(() => 
    wonBids
      .filter(b => b.roi && b.roi < 0.5)
      .sort((a, b) => (a.roi || 0) - (b.roi || 0))
      .slice(0, 5),
    [wonBids]
  );

  // Statistiques globales
  const stats = useMemo(() => {
    const totalBids = enrichedBids.length;
    const wonCount = enrichedBids.filter(b => b.statut === 'won').length;
    const successRate = totalBids > 0 ? ((wonCount / totalBids) * 100).toFixed(1) : '0';
    const avgBudget = wonBids.length > 0
      ? (wonBids.reduce((sum, b) => sum + b.montant, 0) / wonBids.length).toFixed(0)
      : '0';
    const avgROI = wonBids.length > 0
      ? (wonBids.reduce((sum, b) => sum + (b.roi || 0), 0) / wonBids.length).toFixed(2)
      : '0';

    return { totalBids, wonCount, successRate, avgBudget, avgROI };
  }, [enrichedBids, wonBids]);

  // Export CSV
  const exportToCSV = () => {
    const headers = [
      'Round', 'Date', 'Manager', 'Coureur', 'Équipe', 'Montant', 
      'Statut', 'Concurrent', 'Montant Gagnant', 'Points', 'ROI'
    ];
    
    const rows = enrichedBids.map(bid => [
      bid.round_number,
      format(new Date(bid.created_at), 'dd/MM/yyyy'),
      bid.managers.nom,
      bid.coureurs.nom,
      bid.coureurs.equipe || '',
      bid.montant,
      bid.statut,
      bid.winner_name || '',
      bid.winning_amount || '',
      bid.total_points || '',
      bid.roi !== null ? `×${bid.roi.toFixed(2)}` : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historique-encheres-${Date.now()}.csv`;
    link.click();
  };

  // Récupérer les rounds uniques
  const availableRounds = useMemo(() => {
    if (!bids) return [];
    const rounds = [...new Set(bids.map(b => b.round_number))];
    return rounds.sort((a, b) => b - a);
  }, [bids]);

  if (bidsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>📊 Historique des Enchères</CardTitle>
              <CardDescription>
                Analyse complète des décisions managériales
              </CardDescription>
            </div>
            <Button variant="outline" onClick={exportToCSV} disabled={enrichedBids.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedManager || "all"} onValueChange={(v) => setSelectedManager(v === "all" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les managers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les managers</SelectItem>
                  {managers?.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedRound || "all"} onValueChange={(v) => setSelectedRound(v === "all" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les rounds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rounds</SelectItem>
                  {availableRounds.map(r => (
                    <SelectItem key={r} value={r.toString()}>Round {r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="timeline">Chronologie</TabsTrigger>
              <TabsTrigger value="analysis">Analyse</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
              {enrichedBids.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Aucune enchère trouvée pour cette sélection
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Round</TableHead>
                        <TableHead className="w-24">Date</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>Coureur</TableHead>
                        <TableHead className="text-right w-20">Montant</TableHead>
                        <TableHead className="w-24">Statut</TableHead>
                        <TableHead>Concurrent</TableHead>
                        <TableHead className="text-right w-16">Points</TableHead>
                        <TableHead className="text-right w-20">ROI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrichedBids.map(bid => (
                        <TableRow key={bid.id}>
                          <TableCell className="font-mono text-sm">R{bid.round_number}</TableCell>
                          <TableCell className="text-sm">{format(new Date(bid.created_at), 'dd/MM/yy')}</TableCell>
                          <TableCell>
                            <ManagerNameWithJersey managerId={bid.manager_id} managerName={bid.managers.nom} />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{bid.coureurs.nom}</div>
                              <div className="text-xs text-muted-foreground">{bid.coureurs.equipe}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{bid.montant}</TableCell>
                          <TableCell>
                            <Badge variant={
                              bid.statut === 'won' ? 'default' :
                              bid.statut === 'lost' ? 'destructive' :
                              bid.statut === 'carried_over' ? 'secondary' : 'outline'
                            }>
                              {bid.statut}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {bid.statut === 'lost' && bid.winner_name && (
                              <div className="text-sm">
                                <div>{bid.winner_name}</div>
                                <div className="text-muted-foreground text-xs">{bid.winning_amount}€</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {bid.statut === 'won' ? bid.total_points : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {bid.roi !== null && (
                              <Badge variant={bid.roi >= 1 ? 'default' : bid.roi >= 0.5 ? 'secondary' : 'destructive'}>
                                ×{bid.roi.toFixed(2)}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      🏆 Best Picks (Top 5)
                    </CardTitle>
                    <CardDescription>Coureurs avec le meilleur ROI</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {bestPicks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun coureur avec ROI ≥ 1
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {bestPicks.map((bid, idx) => (
                          <div key={bid.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div className="text-lg font-bold text-muted-foreground">#{idx + 1}</div>
                              <div>
                                <div className="font-medium">{bid.coureurs.nom}</div>
                                <div className="text-xs text-muted-foreground">
                                  {bid.total_points} pts / {bid.montant}€
                                </div>
                              </div>
                            </div>
                            <Badge variant="default" className="text-sm">
                              ×{bid.roi?.toFixed(2)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                      💸 Flops (Top 5)
                    </CardTitle>
                    <CardDescription>Coureurs avec le pire ROI</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {flops.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun coureur avec ROI &lt; 0.5
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {flops.map((bid, idx) => (
                          <div key={bid.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div className="text-lg font-bold text-muted-foreground">#{idx + 1}</div>
                              <div>
                                <div className="font-medium">{bid.coureurs.nom}</div>
                                <div className="text-xs text-muted-foreground">
                                  {bid.total_points} pts / {bid.montant}€
                                </div>
                              </div>
                            </div>
                            <Badge variant="destructive" className="text-sm">
                              ×{bid.roi?.toFixed(2)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    📈 Statistiques Globales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{stats.totalBids}</div>
                      <div className="text-xs text-muted-foreground">Total enchères</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{stats.successRate}%</div>
                      <div className="text-xs text-muted-foreground">Taux de succès</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{stats.avgBudget}€</div>
                      <div className="text-xs text-muted-foreground">Budget moyen</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">×{stats.avgROI}</div>
                      <div className="text-xs text-muted-foreground">ROI moyen</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

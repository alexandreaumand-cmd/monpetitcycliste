import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Shirt } from "lucide-react";
import { useState } from "react";
import { formatAmount } from "@/lib/utils";
import { RiderPointsDetail } from "@/components/team/RiderPointsDetail";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuctionTeamsGridProps {
  phaseId: string;
  managerId: string;
}

type RosterData = {
  id: string;
  manager_id: string;
  coureur_id: string;
  prix_signature: number;
  coureurs: { id: string; nom: string; equipe?: string; prix_initial?: number };
  managers: { nom: string } | null;
  losing_bids?: Array<{
    manager_id: string;
    montant: number;
    manager_nom: string;
  }>;
  winning_round?: number;
};

type ManagerStatus = {
  manager_id: string;
  budget_restant: number;
  slots_restants: number;
  max_coureurs: number;
  budget_depense?: number;
};

// Component for manager jersey icon (extracted to avoid hooks in map)
const ManagerJerseyIcon = ({ managerId }: { managerId: string }) => {
  const { selectedSeason } = useSeasonContext();
  const { data: sponsorData } = useManagerSponsor(managerId, selectedSeason?.id);
  
  return sponsorData?.jersey_image_url ? (
    <img 
      src={sponsorData.jersey_image_url} 
      alt="Maillot" 
      className="h-6 w-6 object-contain rounded"
    />
  ) : (
    <Shirt className="h-4 w-4 text-muted-foreground" />
  );
};

export const AuctionTeamsGrid = ({ phaseId, managerId }: AuctionTeamsGridProps) => {
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRider, setSelectedRider] = useState<{
    id: string;
    nom: string;
    equipe: string;
    prix: number;
  } | null>(null);

  // Get all managers rosters with enriched data
  const rostersQuery = useQuery({
    queryKey: ['all-managers-rosters-enriched', phaseId, leagueId] as const,
    queryFn: async (): Promise<RosterData[]> => {
      if (!leagueId) return [];
      
      // Récupérer la saison_id de la phase
      const phaseResult = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', phaseId)
        .single();
      
      console.log('[AuctionTeamsGrid] phaseId:', phaseId, 'saison_id:', phaseResult.data?.saison_id);

      // Récupérer les rosters avec les infos de base
      const rostersResult = await supabase
        .from('rosters')
        .select(`
          id,
          manager_id,
          coureur_id,
          prix_signature,
          coureurs!inner(id, nom),
          managers(nom)
        `)
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId)
        .order('manager_id');

      if (rostersResult.error) throw rostersResult.error;

      // Récupérer tous les auctions de cette phase pour récupérer les rounds
      const auctionsResult = await supabase
        .from('auctions')
        .select('id, round_number')
        .eq('phase_id', phaseId);

      const auctionIds = auctionsResult.data?.map(a => a.id) || [];

      const saisonId = phaseResult.data?.saison_id || '';
      
      // Enrichir avec équipe, prix initial, managers battus, et round
      const enrichedData: RosterData[] = await Promise.all(
        (rostersResult.data || []).map(async (roster: any) => {
          // Données de saison du coureur (prix initial, equipe_id)
          const coureurSaisonResult = await supabase
            .from('coureurs_saisons')
            .select('equipe_id, prix_initial')
            .eq('coureur_id', roster.coureur_id)
            .eq('saison_id', saisonId)
            .maybeSingle();
          
          console.log('[AuctionTeamsGrid] coureur:', roster.coureur_id, 'coureurSaisonResult:', coureurSaisonResult.data);

          // Nom de l'équipe depuis equipes_saisons
          let equipeNom = 'N/A';
          if (coureurSaisonResult.data?.equipe_id && saisonId) {
            const equipeResult = await supabase
              .from('equipes_saisons')
              .select('nom_affiche')
              .eq('equipe_id', coureurSaisonResult.data.equipe_id)
              .eq('saison_id', saisonId)
              .maybeSingle();
            console.log('[AuctionTeamsGrid] coureur:', roster.coureur_id, 'equipeResult:', equipeResult.data);
            equipeNom = equipeResult.data?.nom_affiche || 'N/A';
          }

          // Enchères perdues pour ce coureur
          const lostBidsResult = await supabase
            .from('bids')
            .select(`
              manager_id,
              montant,
              managers(nom)
            `)
            .eq('coureur_id', roster.coureur_id)
            .eq('league_id', leagueId)
            .eq('statut', 'lost')
            .in('auction_id', auctionIds);

          // Round où le coureur a été gagné
          const winningBidResult = await supabase
            .from('bids')
            .select('round_number')
            .eq('coureur_id', roster.coureur_id)
            .eq('manager_id', roster.manager_id)
            .eq('league_id', leagueId)
            .eq('statut', 'won')
            .in('auction_id', auctionIds)
            .maybeSingle();

          return {
            id: roster.id,
            manager_id: roster.manager_id,
            coureur_id: roster.coureur_id,
            prix_signature: roster.prix_signature,
            coureurs: {
              ...roster.coureurs,
              equipe: equipeNom,
              prix_initial: coureurSaisonResult.data?.prix_initial || 0
            },
            managers: roster.managers,
            losing_bids: (lostBidsResult.data || []).map((bid: any) => ({
              manager_id: bid.manager_id,
              montant: bid.montant,
              manager_nom: bid.managers?.nom || 'Inconnu'
            })),
            winning_round: winningBidResult.data?.round_number || null
          };
        })
      );

      return enrichedData;
    },
    enabled: !leagueLoading && !!leagueId,
  });

  // Get managers status (budget, slots)
  const statusQuery = useQuery({
    queryKey: ['managers-rosters-status', phaseId, leagueId] as const,
    queryFn: async () => {
      if (!leagueId) return [] as ManagerStatus[];
      
      const result = await supabase
        .from('managers_rosters_status')
        .select('manager_id, budget_restant, budget_depense, slots_restants, max_coureurs, phase_id, league_id');

      if (result.error) throw result.error;
      
      const filtered = (result.data || []).filter(
        (item: any) => item.phase_id === phaseId && item.league_id === leagueId
      );
      
      return filtered as ManagerStatus[];
    },
    enabled: !leagueLoading && !!leagueId,
  });

  const allManagersRosters = rostersQuery.data || [];
  const managersStatus = statusQuery.data || [];
  const isLoading = rostersQuery.isLoading;

  // Group rosters by manager (exclude current user)
  const rostersByManager = allManagersRosters
    .filter((r) => r.manager_id !== managerId)
    .reduce((acc: any, roster) => {
      const mgrId = roster.manager_id;
      if (!acc[mgrId]) {
        const status = managersStatus.find((s) => s.manager_id === mgrId);
        acc[mgrId] = {
          managerName: roster.managers?.nom || 'Inconnu',
          rosters: [],
          budgetRestant: status?.budget_restant || 0,
          slotsRestants: status?.slots_restants || 0,
          maxCoureurs: status?.max_coureurs || 0
        };
      }
      acc[mgrId].rosters.push(roster);
      return acc;
    }, {});

  // Filter by search term
  const filteredManagers = Object.entries(rostersByManager).filter(([_, data]: [string, any]) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const managerMatch = data.managerName.toLowerCase().includes(searchLower);
    const coureurMatch = data.rosters.some((r: any) => 
      r.coureurs.nom.toLowerCase().includes(searchLower)
    );
    return managerMatch || coureurMatch;
  });

  // Utility functions
  const getBudgetVariant = (budget: number): "default" | "secondary" | "destructive" => {
    if (budget < 100) return "destructive";
    if (budget < 300) return "secondary";
    return "default";
  };

  const getDiffVariant = (diff: number): "default" | "destructive" | "outline" => {
    if (diff > 50) return "destructive";
    if (diff < -20) return "default";
    return "outline";
  };

  const calculateStats = (rosters: any[]) => {
    const totalSpent = rosters.reduce((sum, r) => sum + parseFloat(r.prix_signature.toString()), 0);
    const avgPrice = rosters.length > 0 ? totalSpent / rosters.length : 0;
    const mostExpensive = rosters.length > 0 ? Math.max(...rosters.map(r => parseFloat(r.prix_signature.toString()))) : 0;
    return { totalSpent, avgPrice, mostExpensive };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un manager ou coureur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline">
          {filteredManagers.length} manager(s)
        </Badge>
      </div>

      {filteredManagers.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground border rounded-lg">
          Aucune équipe trouvée
        </div>
      ) : (
        <Accordion type="single" collapsible className="space-y-3">
          {filteredManagers.map(([mgrId, data]: [string, any]) => {
            // Calculate stats directly without useMemo
            const totalSpent = data.rosters.reduce((sum: number, r: any) => sum + parseFloat(r.prix_signature.toString()), 0);
            const avgPrice = data.rosters.length > 0 ? totalSpent / data.rosters.length : 0;
            const mostExpensive = data.rosters.length > 0 ? Math.max(...data.rosters.map((r: any) => parseFloat(r.prix_signature.toString()))) : 0;
            
            return (
              <AccordionItem 
                key={mgrId} 
                value={mgrId}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 [&[data-state=open]]:bg-yellow-50 dark:[&[data-state=open]]:bg-yellow-950/20 no-underline hover:no-underline [&>svg]:ml-auto">
                  <div className="flex items-center justify-between w-full pr-4">
                    {/* Left: Manager info */}
                    <div className="flex items-center gap-3">
                      <ManagerJerseyIcon managerId={mgrId} />
                      <div className="text-left">
                        <p className="font-semibold">{data.managerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {data.rosters.length}/{data.maxCoureurs} coureurs · {data.slotsRestants} slots
                        </p>
                      </div>
                    </div>

                    {/* Center: KPIs */}
                    <div className="hidden md:flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Dépensé: </span>
                        <span className="font-medium">{formatAmount(totalSpent)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Moyen: </span>
                        <span className="font-medium">{formatAmount(avgPrice)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Max: </span>
                        <span className="font-medium">{formatAmount(mostExpensive)}</span>
                      </div>
                    </div>

                    {/* Right: Budget restant */}
                    <Badge 
                      variant={getBudgetVariant(data.budgetRestant)}
                      className="text-sm px-3 py-1"
                    >
                      💰 {formatAmount(data.budgetRestant)} restant
                    </Badge>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-4 pb-4">
                  <div className="bg-muted/30 rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Coureur</TableHead>
                          <TableHead className="text-right">Prix payé</TableHead>
                          <TableHead className="text-right">Cote</TableHead>
                          <TableHead className="text-right">Diff.</TableHead>
                          <TableHead>Managers battus</TableHead>
                          <TableHead className="text-center">Round</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.rosters
                          .sort((a: any, b: any) => parseFloat(b.prix_signature.toString()) - parseFloat(a.prix_signature.toString()))
                          .map((roster: any) => {
                            const prixPaye = parseFloat(roster.prix_signature.toString());
                            const cote = roster.coureurs.prix_initial || 0;
                            const diff = prixPaye - cote;
                            
                            return (
                              <TableRow 
                                key={roster.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => setSelectedRider({
                                  id: roster.coureur_id,
                                  nom: roster.coureurs.nom,
                                  equipe: roster.coureurs.equipe || 'N/A',
                                  prix: prixPaye
                                })}
                              >
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{roster.coureurs.nom}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {roster.coureurs.equipe || 'N/A'}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatAmount(prixPaye)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatAmount(cote)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={getDiffVariant(diff)}>
                                    {diff > 0 ? `+${formatAmount(diff)}` : formatAmount(diff)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {roster.losing_bids && roster.losing_bids.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {roster.losing_bids.map((bid: any, idx: number) => (
                                        <Badge 
                                          key={`${bid.manager_id}-${idx}`}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {bid.manager_nom} ({formatAmount(bid.montant)})
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Aucun
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {roster.winning_round ? (
                                    <Badge variant="secondary">
                                      R{roster.winning_round}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <RiderPointsDetail
        isOpen={!!selectedRider}
        onClose={() => setSelectedRider(null)}
        riderId={selectedRider?.id || ''}
        riderName={selectedRider?.nom || ''}
        riderTeam={selectedRider?.equipe || ''}
        riderPrice={selectedRider?.prix || 0}
        phaseId={phaseId}
      />
    </div>
  );
};
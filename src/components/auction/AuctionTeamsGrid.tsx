import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Shirt } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/utils";
import { RiderPointsDetail } from "@/components/team/RiderPointsDetail";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";

interface AuctionTeamsGridProps {
  phaseId: string;
  managerId: string;
}

export const AuctionTeamsGrid = ({ phaseId, managerId }: AuctionTeamsGridProps) => {
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRider, setSelectedRider] = useState<{
    id: string;
    nom: string;
    equipe: string;
    prix: number;
  } | null>(null);

  // Get all managers rosters
  const { data: allManagersRosters = [], isLoading } = useQuery<any[]>({
    queryKey: ['all-managers-rosters', phaseId, leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      
      // Récupérer la saison_id de la phase
      const { data: phaseInfo } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', phaseId)
        .single();

      const { data, error } = await supabase
        .from('rosters')
        .select(`
          *,
          coureurs!inner(id, nom),
          managers(nom)
        `)
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId)
        .order('manager_id');

      if (error) throw error;

      // Enrichir avec l'équipe de la saison
      const enrichedData = await Promise.all(
        (data || []).map(async (roster) => {
          const { data: seasonData } = await supabase
            .from('coureurs_saisons')
            .select('equipe')
            .eq('coureur_id', roster.coureur_id)
            .eq('saison_id', phaseInfo?.saison_id || '')
            .maybeSingle();

          return {
            ...roster,
            coureurs: {
              ...roster.coureurs,
              equipe: seasonData?.equipe || 'N/A'
            }
          };
        })
      );

      return enrichedData;
    },
    enabled: !leagueLoading && !!leagueId,
  });

  // Get managers status (budget, slots)
  const { data: managersStatus = [] } = useQuery<any[]>({
    queryKey: ['managers-rosters-status', phaseId, leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      
      const { data, error } = await supabase
        .from('managers_rosters_status')
        .select('*')
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId);

      if (error) throw error;
      return data || [];
    },
    enabled: !leagueLoading && !!leagueId,
  });

  // Group rosters by manager (exclude current user)
  const rostersByManager = allManagersRosters
    .filter((r: any) => r.manager_id !== managerId)
    .reduce((acc: any, roster: any) => {
      const mgrId = roster.manager_id;
      if (!acc[mgrId]) {
        const status = managersStatus.find((s: any) => s.manager_id === mgrId);
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
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune équipe trouvée
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredManagers.map(([mgrId, data]: [string, any]) => {
            const ManagerJerseyHeader = () => {
              const { selectedSeason } = useSeasonContext();
              const { data: sponsorData } = useManagerSponsor(mgrId, selectedSeason?.id);
              
              return (
                <div className="flex items-center gap-2">
                  {sponsorData?.jersey_image_url ? (
                    <img 
                      src={sponsorData.jersey_image_url} 
                      alt="Maillot" 
                      className="h-6 w-6 object-contain rounded"
                    />
                  ) : (
                    <Shirt className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">{data.managerName}</CardTitle>
                </div>
              );
            };
            
            return (
              <Card key={mgrId} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <ManagerJerseyHeader />
                      <p className="text-sm text-muted-foreground">
                        {data.rosters.length}/{data.maxCoureurs} coureurs
                      </p>
                    </div>
                    <Badge 
                      variant={data.budgetRestant < 100 ? "destructive" : "secondary"}
                      className="ml-2"
                    >
                      {formatAmount(data.budgetRestant)} restant
                    </Badge>
                  </div>
                </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Slots restants:</span>
                  <Badge variant="outline">{data.slotsRestants}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dépensé:</span>
                  <span className="font-medium">
                    {formatAmount(data.rosters.reduce((sum: number, r: any) => 
                      sum + parseFloat(r.prix_signature.toString()), 0
                    ))}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {data.rosters
                    .sort((a: any, b: any) => parseFloat(b.prix_signature.toString()) - parseFloat(a.prix_signature.toString()))
                    .map((roster: any) => (
                      <button
                        key={roster.id}
                        onClick={() => setSelectedRider({
                          id: roster.coureur_id,
                          nom: roster.coureurs.nom,
                          equipe: roster.coureurs.equipe,
                          prix: parseFloat(roster.prix_signature.toString())
                        })}
                        className="w-full flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-left"
                      >
                        <div>
                          <p className="font-medium">{roster.coureurs.nom}</p>
                          <p className="text-sm text-muted-foreground">{roster.coureurs.equipe}</p>
                        </div>
                        <Badge variant="outline">
                          {formatAmount(roster.prix_signature)}
                        </Badge>
                      </button>
                    ))}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
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

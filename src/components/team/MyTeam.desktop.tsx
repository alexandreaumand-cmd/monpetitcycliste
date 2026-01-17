import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Trophy, ArrowUpDown, X, Shirt, Star, ArrowUp, ArrowDown, Award } from "lucide-react";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RiderPointsDetail } from "./RiderPointsDetail";
import { RiderSearchBar } from "./RiderSearchBar";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { computeRiderROI, formatROICompact } from "@/domain/stats/roi";

interface Coureur {
  coureur_id: string;
  nom: string;
  equipe: string;
  prix_achat: number;
  cote_initiale: number;
  points_total: number;
  ratio_points_par_prix: number;
  winning_round?: number;
}

interface PointDetail {
  course_nom: string;
  type_classement: string;
  etape_numero: number | null;
  points: number;
  date_classement: string;
  total_points: number;
}

interface TeamKPIs {
  scorers_count: number;
  total_points: number;
  bonus_points: number;
  bonus_rider_points: number;
  total_with_bonus: number;
  wins_count: number;
  my_rank: number | null;
  managers_count: number;
}


type SortBy = 'points' | 'ratio' | 'prix' | 'cote';
type SortDirection = 'asc' | 'desc';

interface Manager {
  id: string;
  nom: string;
}

export const MyTeamDesktop = () => {
  const { toast } = useToast();
  const { phases, activePhase, selectedSeason } = useSeasonContext();
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const [coureurs, setCoureurs] = useState<Coureur[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('points');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [kpis, setKpis] = useState<TeamKPIs>({
    scorers_count: 0,
    total_points: 0,
    bonus_points: 0,
    bonus_rider_points: 0,
    total_with_bonus: 0,
    wins_count: 0,
    my_rank: null,
    managers_count: 0
  });
  
  // Phase state
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  
  // Manager selection state
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Rider detail state
  const [selectedRider, setSelectedRider] = useState<{ id: string; nom: string; equipe: string; prix: number } | null>(null);
  
  // Bonus rider state
  const [bonusRiderSelection, setBonusRiderSelection] = useState<{ coureur_id: string; coureur_nom: string } | null>(null);
  const [hasSelectedBonusRider, setHasSelectedBonusRider] = useState(false);
  const [showBonusRiderDialog, setShowBonusRiderDialog] = useState(false);
  
  // Get manager sponsor for jersey display
  const displayedManagerId = selectedManagerId || currentUserId;
  const { data: managerSponsor } = useManagerSponsor(displayedManagerId, selectedSeason?.id);

  // Desktop version

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (leagueId) {
      loadManagers();
    }
  }, [leagueId]);

  useEffect(() => {
    if (activePhase) {
      setSelectedPhaseId(activePhase.id);
    }
  }, [activePhase]);

  useEffect(() => {
    if (selectedPhaseId && !leagueLoading && leagueId) {
      loadTeam();
    }
  }, [selectedPhaseId, selectedManagerId, leagueId, leagueLoading]);

  const loadCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', session.user.id)
        .single();
        
      if (manager) {
        setCurrentUserId(manager.id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadManagers = async () => {
    if (!leagueId) {
      setManagers([]);
      return;
    }
    
    try {
      // Récupérer les user_ids des membres de la ligue
      const { data: leagueMembers } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId);
      
      if (!leagueMembers || leagueMembers.length === 0) {
        setManagers([]);
        return;
      }
      
      const userIds = leagueMembers.map(m => m.user_id);
      
      // Récupérer les managers correspondants
      const { data: managersData } = await supabase
        .from('managers')
        .select('id, nom, user_id')
        .in('user_id', userIds)
        .order('nom', { ascending: true });
      
      setManagers(managersData || []);
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  };


  const loadTeam = async () => {
    if (!leagueId) {
      setCoureurs([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Récupérer la session pour obtenir le token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session found');
        toast({
          title: "Erreur d'authentification",
          description: "Vous devez être connecté pour voir votre équipe",
          variant: "destructive"
        });
        setCoureurs([]);
        setLoading(false);
        return;
      }

      // Déterminer le manager ID à utiliser
      const targetManagerId = selectedManagerId || (await supabase
        .from('managers')
        .select('id')
        .eq('user_id', session.user.id)
        .single()).data?.id;

      // Appeler la fonction avec le token d'authentification
      const { data, error } = await supabase.functions.invoke('manager-my-team', {
        body: { 
          phase_id: selectedPhaseId,
          manager_id: selectedManagerId,
          league_id: leagueId
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      setCoureurs(data.coureurs || []);
      setKpis(data.kpis || { scorers_count: 0, total_points: 0, bonus_points: 0, bonus_rider_points: 0, total_with_bonus: 0, wins_count: 0, my_rank: null, managers_count: 0 });

      // Fetch standings data from the same view as Rankings
      if (targetManagerId && selectedPhaseId && leagueId) {
        const client: any = supabase;
        const { data: standing } = await client
          .from('v_manager_standings_by_phase_v2')
          .select('total_points, bonus_points')
          .eq('phase_id', selectedPhaseId)
          .eq('manager_id', targetManagerId)
          .eq('league_id', leagueId)
          .maybeSingle();
        
        if (standing) {
          setKpis(prev => ({
            ...prev,
            total_points: Number(standing.total_points) || 0,
            bonus_points: Number(standing.bonus_points) || 0,
            total_with_bonus: Number(standing.total_points) || 0,
          }));
        }
      }

      // Charger le coureur bonus sélectionné (s'il existe)
      if (targetManagerId && selectedPhaseId) {
        const client: any = supabase;
      const { data: bonusRider } = await client
        .from('bonus_rider_selections')
        .select('coureur_id')
        .eq('manager_id', targetManagerId)
        .eq('phase_id', selectedPhaseId)
        .eq('league_id', leagueId)
        .maybeSingle();

        if (bonusRider) {
          // Fetch the rider name separately
          const { data: rider } = await client
            .from('coureurs')
            .select('nom')
            .eq('id', bonusRider.coureur_id)
            .maybeSingle();
            
          setBonusRiderSelection({
            coureur_id: bonusRider.coureur_id,
            coureur_nom: rider?.nom || ''
          });
          setHasSelectedBonusRider(true);
        } else {
          setBonusRiderSelection(null);
          setHasSelectedBonusRider(false);
        }
      }
    } catch (error) {
      console.error('Error loading team:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger votre équipe",
        variant: "destructive"
      });
      setCoureurs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBonusRider = async (coureur_id: string, coureur_nom: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non connecté');

      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (!manager) throw new Error('Manager non trouvé');

      const { error } = await supabase
        .from('bonus_rider_selections')
        .insert({
          manager_id: manager.id,
          phase_id: selectedPhaseId,
          coureur_id,
          league_id: leagueId,
        });

      if (error) throw error;

      toast({
        title: "✅ Coureur bonus sélectionné !",
        description: `${coureur_nom} recevra désormais +25% de points bonus.`,
      });

      setBonusRiderSelection({ coureur_id, coureur_nom });
      setHasSelectedBonusRider(true);
      setShowBonusRiderDialog(false);
      
      // Recharger l'équipe pour afficher l'étoile
      loadTeam();
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openCoureurDetail = (coureur: Coureur) => {
    setSelectedRider({
      id: coureur.coureur_id,
      nom: coureur.nom,
      equipe: coureur.equipe,
      prix: coureur.prix_achat
    });
  };

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const sortedCoureurs = [...coureurs].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'points':
        comparison = b.points_total - a.points_total;
        break;
      case 'ratio':
        comparison = b.ratio_points_par_prix - a.ratio_points_par_prix;
        break;
      case 'prix':
        comparison = b.prix_achat - a.prix_achat;
        break;
      case 'cote':
        comparison = b.cote_initiale - a.cote_initiale;
        break;
      default:
        comparison = 0;
    }
    return sortDirection === 'desc' ? comparison : -comparison;
  });

  // Calculer le top 3 des coureurs par points (FIXE, pas dynamique)
  const top3ByPoints = useMemo(() => {
    const sorted = [...coureurs].sort((a, b) => b.points_total - a.points_total);
    return {
      first: sorted[0]?.coureur_id,
      second: sorted[1]?.coureur_id,
      third: sorted[2]?.coureur_id
    };
  }, [coureurs]);

  const getRatioColor = (ratio: number) => {
    if (ratio > 10) return "text-green-800 dark:text-green-300";
    if (ratio >= 4 && ratio <= 10) return "text-green-600 dark:text-green-400";
    if (ratio >= 2 && ratio < 4) return "text-yellow-600 dark:text-yellow-400";
    if (ratio > 0 && ratio < 2) return "text-orange-600 dark:text-orange-400";
    if (ratio === 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getRatioBgColor = (ratio: number) => {
    if (ratio > 10) return "bg-green-100 dark:bg-green-950/30 border-green-300 dark:border-green-800";
    if (ratio >= 4 && ratio <= 10) return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900";
    if (ratio >= 2 && ratio < 4) return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900";
    if (ratio > 0 && ratio < 2) return "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900";
    if (ratio === 0) return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900";
    return "";
  };

  // Helper pour déterminer la classe CSS du badge ratio (couleur simple)
  const getRatioBadgeClass = (ratio: number | undefined): string => {
    if (!ratio || ratio === 0) return "bg-gray-100 text-gray-700 border-gray-300";
    
    if (ratio >= 15) return "bg-green-600 text-white border-green-700 font-bold";
    if (ratio >= 10) return "bg-green-500 text-white border-green-600 font-semibold";
    if (ratio >= 7) return "bg-lime-500 text-white border-lime-600";
    if (ratio >= 5) return "bg-yellow-400 text-gray-900 border-yellow-500";
    if (ratio >= 3) return "bg-orange-400 text-gray-900 border-orange-500";
    
    return "bg-red-500 text-white border-red-600";
  };

  const getPhaseLabel = (phase: any) => {
    return `Phase ${phase.index_dans_saison}${phase.statut === 'active' ? ' ✓' : ''}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile layout */}
      <div className="flex flex-col gap-3 md:hidden">
        <div>
          <h1 className="text-3xl font-bold">
            {selectedManagerId && selectedManagerId !== currentUserId
              ? managers.find(m => m.id === selectedManagerId)?.nom
              : 'Mon équipe'}
          </h1>
          <p className="text-muted-foreground">
            {coureurs.length} coureur{coureurs.length > 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Manager selector - mobile */}
        {managers.length > 0 && (
          <Select value={selectedManagerId || '__MY_TEAM__'} onValueChange={(v) => setSelectedManagerId(v === '__MY_TEAM__' ? null : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Mon équipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__MY_TEAM__">Mon équipe</SelectItem>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* Phase selector - mobile */}
        {phases.length > 0 && (
          <Select value={selectedPhaseId || ''} onValueChange={setSelectedPhaseId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner une phase" />
            </SelectTrigger>
            <SelectContent>
              {phases.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  {getPhaseLabel(phase)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* Sort buttons - mobile */}
        <div className="flex gap-2 overflow-x-auto">
          <Button
            variant={sortBy === 'points' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('points')}
          >
            <Trophy className="h-4 w-4 mr-2" />
            Points
          </Button>
          <Button
            variant={sortBy === 'ratio' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('ratio')}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Ratio
          </Button>
          <Button
            variant={sortBy === 'prix' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('prix')}
          >
            Prix
          </Button>
          <Button
            variant={sortBy === 'cote' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('cote')}
          >
            Cote
          </Button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block">
        {/* Compact Header */}
        <div className="flex items-center gap-3">
          {managerSponsor?.jersey_image_url && (
            <img 
              src={managerSponsor.jersey_image_url} 
              alt="Maillot" 
              className="h-16 w-16 object-contain flex-shrink-0"
            />
          )}
          
          <div className="flex gap-2 flex-1">
            {managers.length > 0 && (
              <Select value={selectedManagerId || '__MY_TEAM__'} onValueChange={(v) => setSelectedManagerId(v === '__MY_TEAM__' ? null : v)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Mon équipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__MY_TEAM__">Mon équipe</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {phases.length > 0 && (
              <Select value={selectedPhaseId || ''} onValueChange={setSelectedPhaseId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Phase" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {getPhaseLabel(phase)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!hasSelectedBonusRider && !selectedManagerId && (
            <Button
              onClick={() => setShowBonusRiderDialog(true)}
              variant="secondary"
              size="sm"
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Barre de recherche de coureur */}
        {leagueId && selectedPhaseId && (
          <div className="mt-3">
            <RiderSearchBar
              phaseId={selectedPhaseId}
              leagueId={leagueId}
              onSelectManager={(managerId) => {
                setSelectedManagerId(managerId);
              }}
            />
          </div>
        )}
      </div>

      {/* KPIs compacts */}
      {coureurs.length > 0 && (
        <Card className="border-2 border-black">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-4">
              {/* Total Points */}
              <div className="text-center">
                <Trophy className="h-5 w-5 mx-auto text-[#FFD500] mb-1" />
                <div className="text-2xl font-bold">{kpis.total_points}</div>
                <div className="text-xs text-muted-foreground">Total pts</div>
              </div>
              
              {/* Bonus Points */}
              <div className="text-center">
                <Star className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <div className="text-2xl font-bold">{kpis.bonus_points}</div>
                <div className="text-xs text-muted-foreground">Bonus pts</div>
              </div>
              
              {/* Scorers */}
              <div className="text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <div className="text-2xl font-bold">{kpis.scorers_count}/{coureurs.length}</div>
                <div className="text-xs text-muted-foreground">Scoreurs</div>
              </div>
              
              {/* Rank */}
              <div className="text-center">
                <Trophy className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                <div className="text-2xl font-bold">
                  {kpis.my_rank ? `#${kpis.my_rank}` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {kpis.managers_count > 0 ? `/${kpis.managers_count}` : 'Classement'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {coureurs.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Équipe vide</h3>
          <p className="text-muted-foreground">
            Votre équipe est vide pour cette phase
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coureur</TableHead>
                  <TableHead>Équipe</TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('prix')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      💰 Prix
                      {sortBy === 'prix' && (
                        sortDirection === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('cote')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Cote
                      {sortBy === 'cote' && (
                        sortDirection === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('points')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Points totaux
                      {sortBy === 'points' && (
                        sortDirection === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('ratio')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Ratio
                      {sortBy === 'ratio' && (
                        sortDirection === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCoureurs.map((coureur) => (
                  <TableRow 
                    key={coureur.coureur_id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openCoureurDetail(coureur)}
                  >
                    <TableCell className="font-medium py-2">
                      <div className="flex items-center gap-2">
                        {bonusRiderSelection?.coureur_id === coureur.coureur_id && (
                          <Star className="h-4 w-4 text-[#FFD500] fill-[#FFD500]" />
                        )}
                        {coureur.nom}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground py-2">
                      {coureur.equipe}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="font-medium">{coureur.prix_achat.toFixed(0)}</span>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-muted-foreground">{coureur.cote_initiale.toFixed(0)}</span>
                        {coureur.winning_round && (
                          <span className="text-xs text-muted-foreground/60">R{coureur.winning_round}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center justify-end gap-2">
                        {/* Icône top 3 FIXE basée sur les points */}
                        {coureur.coureur_id === top3ByPoints.first && (
                          <Trophy className="h-5 w-5 text-yellow-500" />
                        )}
                        {coureur.coureur_id === top3ByPoints.second && (
                          <Award className="h-5 w-5 text-gray-400" />
                        )}
                        {coureur.coureur_id === top3ByPoints.third && (
                          <Award className="h-5 w-5 text-amber-700" />
                        )}
                        <span className="font-bold text-lg">{coureur.points_total}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <Badge className={`${getRatioBadgeClass(
                        computeRiderROI({
                          pointsTotal: coureur.points_total,
                          purchasePriceTotal: coureur.prix_achat
                        })
                      )} border-2`}>
                        {formatROICompact(computeRiderROI({
                          pointsTotal: coureur.points_total,
                          purchasePriceTotal: coureur.prix_achat
                        }))}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile list - sans vignettes */}
          <div className="space-y-0 md:hidden divide-y">
            {sortedCoureurs.map((coureur) => (
              <div 
                key={coureur.coureur_id}
                className={`cursor-pointer hover:bg-muted/50 p-4 transition-colors ${getRatioBgColor(coureur.ratio_points_par_prix)}`}
                onClick={() => openCoureurDetail(coureur)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-base">{coureur.nom}</div>
                    <div className="text-sm text-muted-foreground mt-1">{coureur.equipe}</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end mb-1">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="font-bold text-lg">{coureur.points_total}</span>
                    </div>
                    <div className={`flex items-center gap-1 justify-end font-semibold text-sm ${getRatioColor(coureur.ratio_points_par_prix)}`}>
                      {coureur.ratio_points_par_prix > 1 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : coureur.ratio_points_par_prix < 1 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      <span>{formatROICompact(computeRiderROI({
                        pointsTotal: coureur.points_total,
                        purchasePriceTotal: coureur.prix_achat
                      }))}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Prix: <span className="font-semibold text-foreground">{coureur.prix_achat.toFixed(0)}</span></span>
                  <span>Cote: <span className="font-semibold text-foreground">{coureur.cote_initiale.toFixed(0)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bonus Rider Selection Dialog */}
      <Dialog open={showBonusRiderDialog} onOpenChange={setShowBonusRiderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir votre coureur bonus</DialogTitle>
              <DialogDescription>
                Sélectionnez un coureur avec une cote initiale de 10 ou 20 qui recevra +25% de points bonus.
                <br />⚠️ Ce choix est définitif pour cette phase.
              </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {coureurs
              .filter(c => c.cote_initiale === 10 || c.cote_initiale === 20)
              .map((coureur) => (
                <Button
                  key={coureur.coureur_id}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => handleSelectBonusRider(coureur.coureur_id, coureur.nom)}
                >
                  <Star className="h-5 w-5 text-amber-500" />
                      <div className="text-left">
                        <div className="font-semibold">{coureur.nom}</div>
                        <div className="text-xs text-muted-foreground">
                          {coureur.equipe} • Cote: {coureur.cote_initiale} • {coureur.points_total} pts
                        </div>
                      </div>
                </Button>
              ))}
            
            {coureurs.filter(c => c.cote_initiale === 10 || c.cote_initiale === 20).length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Aucun coureur éligible (cote initiale 10 ou 20)
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rider Points Detail */}
      <RiderPointsDetail
        isOpen={!!selectedRider}
        onClose={() => setSelectedRider(null)}
        riderId={selectedRider?.id || ''}
        riderName={selectedRider?.nom || ''}
        riderTeam={selectedRider?.equipe || ''}
        riderPrice={selectedRider?.prix || 0}
        phaseId={selectedPhaseId || ''}
      />
    </div>
  );
};

const ManagerJerseyDisplay = () => {
  const { selectedSeason } = useSeasonContext();
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  
  // Get current user's manager_id
  useEffect(() => {
    const loadCurrentManager = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', session.user.id)
        .single();
        
      if (manager) {
        setSelectedManagerId(manager.id);
      }
    };
    
    loadCurrentManager();
  }, []);
  
  const { data: sponsorData } = useManagerSponsor(selectedManagerId || undefined, selectedSeason?.id);
  
  if (!sponsorData?.jersey_image_url) {
    return <Shirt className="h-8 w-8 text-muted-foreground" />;
  }
  
  return (
    <img 
      src={sponsorData.jersey_image_url} 
      alt="Maillot" 
      className="h-10 w-10 object-contain rounded"
    />
  );
};

export default MyTeamDesktop;

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Trophy, ArrowUpDown, X, Shirt, Star, ArrowUp, ArrowDown, Award, Eye, Users, ArrowRightLeft, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
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
import { RiderRaceIcons } from "./RiderRaceIcons";
import { useLeagueFilteredRaces } from "@/hooks/useLeagueFilteredRaces";
import { LeagueBonusRidersDialog } from "./LeagueBonusRidersDialog";
import { LeagueRostersOverviewDialog } from "./LeagueRostersOverviewDialog";
import { useQuery } from "@tanstack/react-query";

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
  race_days?: number;
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
  total_race_days?: number;
}


type SortBy = 'points' | 'ratio' | 'prix' | 'cote' | 'nom' | 'equipe' | 'jours';
type SortDirection = 'asc' | 'desc';

interface Manager {
  id: string;
  nom: string;
}

export const MyTeamDesktop = () => {
  const { t } = useTranslation('team');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { phases, activePhase, selectedSeason } = useSeasonContext();
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const { leagues } = useUserLeagues();
  const currentLeague = leagues.find(l => l.id === leagueId);
  const isPerCourse = currentLeague?.game_mode === 'per_course';
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
  const [selectedRider, setSelectedRider] = useState<{ id: string; nom: string; equipe: string; prix: number; cote: number; round?: number } | null>(null);
  
  // Bonus rider state
  const [bonusRiderSelection, setBonusRiderSelection] = useState<{ coureur_id: string; coureur_nom: string } | null>(null);
  const [hasSelectedBonusRider, setHasSelectedBonusRider] = useState(false);
  const [showBonusRiderDialog, setShowBonusRiderDialog] = useState(false);
  const [showLeagueBonusDialog, setShowLeagueBonusDialog] = useState(false);
  const [showRostersOverviewDialog, setShowRostersOverviewDialog] = useState(false);
  
  // Get manager sponsor for jersey display
  const displayedManagerId = selectedManagerId || currentUserId;
  const { data: managerSponsor } = useManagerSponsor(displayedManagerId, selectedSeason?.id);

  // Fetch rider races for all team riders
  const riderIds = coureurs.map(c => c.coureur_id);
  const { data: riderRacesData } = useQuery({
    queryKey: ['team-riders-races', riderIds],
    queryFn: async () => {
      if (riderIds.length === 0) return { races_by_rider: {} };
      
      const { data, error } = await supabase.functions.invoke('get-team-riders-races', {
        body: { rider_ids: riderIds }
      });
      
      if (error) throw error;
      return data as { races_by_rider: Record<string, { current_races: any[]; upcoming_races: any[] }> };
    },
    enabled: riderIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const filteredRacesData = useLeagueFilteredRaces(leagueId, riderRacesData);


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
          .select('total_points, manager_bonus, rider_bonus')
          .eq('phase_id', selectedPhaseId)
          .eq('manager_id', targetManagerId)
          .eq('league_id', leagueId)
          .maybeSingle();
        
        if (standing) {
          const managerBonus = Number(standing.manager_bonus) || 0;
          const riderBonus = Number(standing.rider_bonus) || 0;
          setKpis(prev => ({
            ...prev,
            total_points: Number(standing.total_points) || 0,
            bonus_points: managerBonus,
            bonus_rider_points: riderBonus,
            total_with_bonus: Number(standing.total_points) || 0,
          }));
        } else {
          // No standings row = 0 points for this league scope
          setKpis(prev => ({
            ...prev,
            total_points: 0,
            bonus_points: 0,
            bonus_rider_points: 0,
            total_with_bonus: 0,
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
        title: `✅ ${t('bonusRider.successTitle')}`,
        description: t('bonusRider.successDescription', { name: coureur_nom }),
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
      prix: coureur.prix_achat,
      cote: coureur.cote_initiale,
      round: coureur.winning_round
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
      case 'nom':
        comparison = a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
        return sortDirection === 'desc' ? comparison : -comparison;
      case 'equipe':
        comparison = a.equipe.localeCompare(b.equipe, 'fr', { sensitivity: 'base' });
        return sortDirection === 'desc' ? comparison : -comparison;
      case 'jours':
        comparison = (b.race_days || 0) - (a.race_days || 0);
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
    if (ratio >= 2 && ratio < 4) return "text-bordure-gold dark:text-bordure-gold";
    if (ratio > 0 && ratio < 2) return "text-primary dark:text-primary";
    if (ratio === 0) return "text-muted-foreground";
    return "text-muted-foreground";
  };

  const getRatioBgColor = (ratio: number) => {
    if (ratio > 10) return "bg-green-100 dark:bg-green-950/30 border-green-300 dark:border-green-800";
    if (ratio >= 4 && ratio <= 10) return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900";
    if (ratio >= 2 && ratio < 4) return "bg-accent dark:bg-accent/20 border-bordure-gold/30 dark:border-bordure-gold/20";
    if (ratio > 0 && ratio < 2) return "bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20";
    if (ratio === 0) return "bg-muted dark:bg-muted border-border dark:border-border";
    return "";
  };

  // Helper pour déterminer la classe CSS du badge ratio (couleur simple)
  const getRatioBadgeClass = (ratio: number | undefined): string => {
    if (!ratio || ratio === 0) return "bg-gray-100 text-gray-700 border-gray-300";
    
    if (ratio >= 15) return "bg-green-600 text-white border-green-700 font-bold";
    if (ratio >= 10) return "bg-green-500 text-white border-green-600 font-semibold";
    if (ratio >= 7) return "bg-lime-500 text-white border-lime-600";
    if (ratio >= 5) return "bg-bordure-gold text-gray-900 border-bordure-gold";
    if (ratio >= 3) return "bg-orange-400 text-gray-900 border-orange-500";
    
    return "bg-muted text-muted-foreground border-border";
  };

  const getPhaseLabel = (phase: any) => {
    return `${t('phase')} ${phase.index_dans_saison}`;
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
              : t('myTeam')}
          </h1>
          <p className="text-muted-foreground">
            {t('riderCount', { count: coureurs.length })}
          </p>
        </div>
        
        {/* Manager selector - mobile */}
        {managers.length > 0 && (
          <Select value={selectedManagerId || '__MY_TEAM__'} onValueChange={(v) => setSelectedManagerId(v === '__MY_TEAM__' ? null : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('myTeam')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__MY_TEAM__">{t('myTeam')}</SelectItem>
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
              <SelectValue placeholder={t('selectPhase')} />
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
            {t('sort.points')}
          </Button>
          <Button
            variant={sortBy === 'ratio' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('ratio')}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            {t('sort.ratio')}
          </Button>
          <Button
            variant={sortBy === 'prix' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('prix')}
          >
            {t('sort.price')}
          </Button>
          <Button
            variant={sortBy === 'cote' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('cote')}
          >
            {t('sort.rating')}
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
              <SelectValue placeholder={t('myTeam')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__MY_TEAM__">{t('myTeam')}</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {!isPerCourse && phases.length > 0 && (
              <Select value={selectedPhaseId || ''} onValueChange={setSelectedPhaseId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('phase')} />
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

          <div className="flex items-center gap-2">
            {!hasSelectedBonusRider && !selectedManagerId && (
              <Button
                onClick={() => setShowBonusRiderDialog(true)}
                variant="secondary"
                size="sm"
                title={t('bonusRider.select')}
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={() => setShowLeagueBonusDialog(true)}
              variant="outline"
              size="sm"
              title={t('bonusRider.viewOthers')}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setShowRostersOverviewDialog(true)}
              variant="outline"
              size="sm"
              title="Vue d'ensemble des effectifs"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                const mId = selectedManagerId || currentUserId;
                const mName = selectedManagerId && selectedManagerId !== currentUserId
                  ? managers.find(m => m.id === selectedManagerId)?.nom || ''
                  : t('myTeam');
                navigate(`/dashboard/mon-equipe/mouvements?managerId=${mId}&phaseId=${selectedPhaseId}&leagueId=${leagueId}&managerName=${encodeURIComponent(mName)}`);
              }}
              variant="outline"
              size="sm"
              title="Mouvements startlists"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </div>

      {/* KPIs compacts */}
      {coureurs.length > 0 && (
        <Card className="border-2 border-black">
          <CardContent className="p-4">
            <div className="grid grid-cols-5 gap-4">
              {/* Total Points */}
              <div className="text-center">
                <Trophy className="h-5 w-5 mx-auto text-bordure-gold mb-1" />
                <div className="text-2xl font-bold">{kpis.total_points}</div>
                <div className="text-xs text-muted-foreground">{t('totalPts')}</div>
              </div>
              
              {/* Bonus Points */}
              <div className="text-center">
                <Star className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <div className="text-2xl font-bold">{kpis.bonus_points}</div>
                <div className="text-xs text-muted-foreground">{t('bonusPts')}</div>
              </div>
              
              {/* Scorers */}
              <div className="text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <div className="text-2xl font-bold">{kpis.scorers_count}</div>
                <div className="text-xs text-muted-foreground">{t('scorers')}</div>
              </div>
              
              {/* Race Days */}
              <div className="text-center">
                <Calendar className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <div className="text-2xl font-bold">{kpis.total_race_days || 0}</div>
                <div className="text-xs text-muted-foreground">{t('raceDays')}</div>
              </div>
              
              {/* Rank */}
              <div className="text-center">
                <Trophy className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                <div className="text-2xl font-bold">
                  {kpis.my_rank ? `#${kpis.my_rank}` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {kpis.managers_count > 0 ? `/${kpis.managers_count}` : t('ranking')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {coureurs.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">{t('emptyTeam')}</h3>
          <p className="text-muted-foreground">
            {t('emptyTeamDescription')}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.rider')}</TableHead>
                  <TableHead>{t('table.team')}</TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('prix')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {t('table.price')}
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
                      {t('table.rating')}
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
                      {t('table.totalPoints')}
                      {sortBy === 'points' && (
                        sortDirection === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('jours')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {t('table.raceDays')}
                      {sortBy === 'jours' && (
                        sortDirection === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('ratio')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {t('table.ratio')}
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
                          <Star className="h-4 w-4 text-bordure-gold fill-bordure-gold" />
                        )}
                        {coureur.nom}
                        <RiderRaceIcons 
                          currentRaces={filteredRacesData?.races_by_rider?.[coureur.coureur_id]?.current_races}
                          upcomingRaces={filteredRacesData?.races_by_rider?.[coureur.coureur_id]?.upcoming_races}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground py-2">
                      {coureur.equipe}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-medium">{coureur.prix_achat.toFixed(0)}</span>
                        {coureur.winning_round && (
                          <span className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground/70">
                            R{coureur.winning_round}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-muted-foreground">{coureur.cote_initiale.toFixed(0)}</span>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center justify-end gap-2">
                        {/* Icône top 3 FIXE basée sur les points */}
                        {coureur.coureur_id === top3ByPoints.first && (
                          <Trophy className="h-5 w-5 text-bordure-gold" />
                        )}
                        {coureur.coureur_id === top3ByPoints.second && (
                          <Award className="h-5 w-5 text-muted-foreground" />
                        )}
                        {coureur.coureur_id === top3ByPoints.third && (
                          <Award className="h-5 w-5 text-amber-700" />
                        )}
                        <span className="font-bold text-lg">{coureur.points_total}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-muted-foreground">{coureur.race_days || 0}</span>
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
                  <span>{t('price')}: <span className="font-semibold text-foreground">{coureur.prix_achat.toFixed(0)}</span></span>
                  <span>{t('rating')}: <span className="font-semibold text-foreground">{coureur.cote_initiale.toFixed(0)}</span></span>
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
            <DialogTitle>{t('bonusRider.selectTitle')}</DialogTitle>
              <DialogDescription>
                {t('bonusRider.description')}
                <br />⚠️ {t('bonusRider.warning')}
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
                      {coureur.equipe} • {t('rating')}: {coureur.cote_initiale} • {coureur.points_total} pts
                    </div>
                  </div>
                </Button>
              ))}
            
            {coureurs.filter(c => c.cote_initiale === 10 || c.cote_initiale === 20).length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                {t('bonusRider.noEligible')}
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
        riderCote={selectedRider?.cote || 0}
        riderRound={selectedRider?.round}
        phaseId={selectedPhaseId || ''}
      />

      {/* League Bonus Riders Dialog */}
      <LeagueBonusRidersDialog
        open={showLeagueBonusDialog}
        onOpenChange={setShowLeagueBonusDialog}
        leagueId={leagueId}
        phaseId={selectedPhaseId}
      />

      {/* League Rosters Overview Dialog */}
      {selectedPhaseId && leagueId && (
        <LeagueRostersOverviewDialog
          open={showRostersOverviewDialog}
          onOpenChange={setShowRostersOverviewDialog}
          leagueId={leagueId}
          phaseId={selectedPhaseId}
          managers={managers}
        />
      )}
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

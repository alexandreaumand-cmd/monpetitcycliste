import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MobileCard,
  MobileEmptyState,
} from "@/components/mobile";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { RiderPointsDetail } from "./RiderPointsDetail";
import { RiderRaceIcons } from "./RiderRaceIcons";
import { useLeagueFilteredRaces } from "@/hooks/useLeagueFilteredRaces";
import { LeagueBonusRidersDialog } from "./LeagueBonusRidersDialog";
import { LeagueRostersOverviewDialog } from "./LeagueRostersOverviewDialog";

import { BonusPointsDetailDialog } from "@/components/rankings/BonusPointsDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  User,
  DollarSign,
  Shirt,
  Star,
  Eye,
  Users,
  ArrowRightLeft,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { computeRiderROI, formatROICompact } from "@/domain/stats/roi";
import { useLeague } from "@/contexts/LeagueContext";
import { useQuery } from "@tanstack/react-query";
import { useCurrentManager } from "@/hooks/useCurrentManager";

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
}


type SortBy = "points" | "ratio" | "prix" | "cote" | "nom" | "equipe";

interface Manager {
  id: string;
  nom: string;
}

export const MyTeamMobile = () => {
  const { t } = useTranslation('team');
  const navigate = useNavigate();
  const { phases, activePhase, selectedSeason } = useSeasonContext();
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const { leagues } = useUserLeagues();
  const currentLeague = leagues.find(l => l.id === leagueId);
  const isPerCourse = currentLeague?.game_mode === 'per_course';
  const bonusesEnabled = currentLeague?.bonuses_enabled !== false;
  const [coureurs, setCoureurs] = useState<Coureur[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("points");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  
  // Use cached current manager hook
  const { data: currentManager } = useCurrentManager();
  const currentUserId = currentManager?.id ?? null;
  
  // Manager selection state
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  
  // Detail drawer
  const [selectedRider, setSelectedRider] = useState<{ id: string; nom: string; equipe: string; prix: number; cote: number; round?: number } | null>(null);
  
  // KPIs state
  const [kpis, setKpis] = useState({ 
    scorers_count: 0, 
    total_points: 0, 
    bonus_points: 0, 
    bonus_rider_points: 0,
    total_with_bonus: 0,
    total_race_days: 0
  });
  
  // Bonus rider state
  const [bonusRiderSelection, setBonusRiderSelection] = useState<{ coureur_id: string; coureur_nom: string } | null>(null);
  const [hasSelectedBonusRider, setHasSelectedBonusRider] = useState(false);
  const [showBonusRiderDialog, setShowBonusRiderDialog] = useState(false);
  const [showLeagueBonusDialog, setShowLeagueBonusDialog] = useState(false);
  const [showRostersOverviewDialog, setShowRostersOverviewDialog] = useState(false);
  
  // Bonus details dialog
  const [bonusDetailsOpen, setBonusDetailsOpen] = useState(false);
  
  // Get manager sponsor for jersey display
  const displayedManagerId = selectedManagerId || currentUserId;
  const { data: managerSponsor } = useManagerSponsor(displayedManagerId, selectedSeason?.id);

  // Fetch rider races for all team riders
  const riderIds = coureurs.map(c => c.coureur_id);
  const { data: riderRacesData } = useQuery({
    queryKey: ['team-riders-races-mobile', riderIds],
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

  // Set active phase when available
  useEffect(() => {
    if (activePhase) {
      setSelectedPhaseId(activePhase.id);
    }
  }, [activePhase]);

  // Load managers when league changes
  useEffect(() => {
    if (leagueLoading || !leagueId) return;
    loadManagers();
  }, [leagueId, leagueLoading]);

  // Load team when phase/manager changes
  useEffect(() => {
    if (selectedPhaseId && !leagueLoading && leagueId) {
      loadTeamWithKpis();
    }
  }, [selectedPhaseId, selectedManagerId, leagueId, leagueLoading]);

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

  const sortedCoureurs = [...coureurs].sort((a, b) => {
    switch (sortBy) {
      case "points":
        return b.points_total - a.points_total;
      case "ratio":
        return b.ratio_points_par_prix - a.ratio_points_par_prix;
      case "prix":
        return b.prix_achat - a.prix_achat;
      case "cote":
        return b.cote_initiale - a.cote_initiale;
      case "nom":
        return a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
      case "equipe":
        return a.equipe.localeCompare(b.equipe, 'fr', { sensitivity: 'base' });
      default:
        return 0;
    }
  });

  const getRatioColor = (ratio: number) => {
    if (ratio > 10) return "text-green-600";
    if (ratio >= 4) return "text-green-500";
    if (ratio >= 2) return "text-bordure-gold";
    if (ratio > 0) return "text-orange-500";
    return "text-red-500";
  };

  const getRatioBgColor = (ratio: number) => {
    if (ratio > 10) return "bg-green-500/10 border-green-500/20";
    if (ratio >= 4) return "bg-green-500/5 border-green-500/10";
    if (ratio >= 2) return "bg-bordure-gold/5 border-bordure-gold/10";
    if (ratio > 0) return "bg-orange-500/5 border-orange-500/10";
    return "bg-red-500/5 border-red-500/10";
  };

  const getPhaseLabel = (phase: any) => {
    return `${t('phase')} ${phase.index_dans_saison}`;
  };


  const loadTeamWithKpis = async () => {
    if (!leagueId) {
      setCoureurs([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Déterminer le manager ID à utiliser
      const targetManagerId = selectedManagerId || (await supabase
        .from('managers')
        .select('id')
        .eq('user_id', session.user.id)
        .single()).data?.id;

      const { data, error } = await supabase.functions.invoke("manager-my-team", {
        body: { 
          phase_id: selectedPhaseId,
          manager_id: selectedManagerId,
          league_id: leagueId
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setCoureurs(data.coureurs || []);
      setKpis(data.kpis || { scorers_count: 0, total_points: 0, bonus_points: 0, bonus_rider_points: 0, total_with_bonus: 0 });

      // Fetch standings data from the same view as Rankings
      if (targetManagerId && selectedPhaseId && leagueId) {
        const { data: standing } = await supabase
          .from('v_manager_standings_by_phase_v2')
          .select('total_points, manager_bonus, rider_bonus')
          .match({ 
            phase_id: selectedPhaseId,
            manager_id: targetManagerId,
            league_id: leagueId
          })
          .maybeSingle();

        if (standing) {
          const totalBonus = (standing.manager_bonus || 0) + (standing.rider_bonus || 0);
          setKpis(prev => ({
            ...prev,
            total_points: Number(standing.total_points) || 0,
            bonus_points: totalBonus,
            total_with_bonus: Number(standing.total_points) || 0,
          }));
        } else {
          setKpis(prev => ({
            ...prev,
            total_points: 0,
            bonus_points: 0,
            total_with_bonus: 0,
          }));
        }
      }

      // Charger le coureur bonus sélectionné (s'il existe)
      if (targetManagerId && selectedPhaseId) {
      const { data: bonusRider } = await supabase
        .from('bonus_rider_selections')
        .select('coureur_id, coureurs(nom)')
        .match({
          manager_id: targetManagerId,
          phase_id: selectedPhaseId,
          league_id: leagueId
        })
        .maybeSingle();

        if (bonusRider) {
          setBonusRiderSelection({
            coureur_id: bonusRider.coureur_id,
            coureur_nom: bonusRider.coureurs.nom
          });
          setHasSelectedBonusRider(true);
        } else {
          setBonusRiderSelection(null);
          setHasSelectedBonusRider(false);
        }
      }
    } catch (error: any) {
      toast.error("Erreur : " + error.message);
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

      toast.success(`✅ ${t('bonusRider.successDescription', { name: coureur_nom })}`);

      setBonusRiderSelection({ coureur_id, coureur_nom });
      setHasSelectedBonusRider(true);
      setShowBonusRiderDialog(false);
      
      // Recharger l'équipe
      loadTeamWithKpis();
    } catch (error: any) {
      toast.error("❌ Erreur : " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Compact Header */}
      <div className="flex items-center gap-2">
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
            <Select value={selectedPhaseId || ""} onValueChange={setSelectedPhaseId}>
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
      </div>


      {/* Stats compactes - une seule ligne */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-xl text-sm">
        <div className="flex items-center gap-1">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="font-semibold">{Math.round(kpis.total_points)}</span>
          <span className="text-muted-foreground">pts</span>
        </div>
        
        {bonusesEnabled && (
          <div 
            className="flex items-center gap-1 cursor-pointer" 
            onClick={() => setBonusDetailsOpen(true)}
          >
            <Star className="h-4 w-4 text-amber-500" />
            <span className="font-semibold">{kpis.bonus_points}</span>
            <span className="text-muted-foreground">bonus</span>
          </div>
        )}
        
        <div className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>{kpis.scorers_count}/{coureurs.length}</span>
        </div>
        
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          <span>{kpis.total_race_days || 0}</span>
          <span>jours</span>
        </div>
      </div>

      {/* Barre tri + actions */}
      <div className="flex items-center gap-2">
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="flex-1 h-9">
            <SelectValue placeholder={t('sort.points')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="points">{t('sort.points')}</SelectItem>
            <SelectItem value="ratio">{t('sort.ratio')}</SelectItem>
            <SelectItem value="prix">{t('sort.price')}</SelectItem>
            <SelectItem value="cote">{t('sort.rating')}</SelectItem>
            <SelectItem value="nom">{t('sort.rider')}</SelectItem>
            <SelectItem value="equipe">{t('sort.team')}</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="ghost" size="icon" onClick={() => setShowRostersOverviewDialog(true)}>
          <Users className="h-5 w-5" />
        </Button>
        {bonusesEnabled && (
          <Button variant="ghost" size="icon" onClick={() => setShowLeagueBonusDialog(true)}>
            <Eye className="h-5 w-5" />
          </Button>
        )}
        {bonusesEnabled && !hasSelectedBonusRider && !selectedManagerId && (
          <Button variant="ghost" size="icon" onClick={() => setShowBonusRiderDialog(true)}>
            <Star className="h-5 w-5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => {
          const mId = selectedManagerId || currentUserId;
          const mName = selectedManagerId && selectedManagerId !== currentUserId
            ? managers.find(m => m.id === selectedManagerId)?.nom || ''
            : t('myTeam');
          navigate(`/dashboard/mon-equipe/mouvements?managerId=${mId}&phaseId=${selectedPhaseId}&leagueId=${leagueId}&managerName=${encodeURIComponent(mName)}`);
        }}>
          <ArrowRightLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Coureurs list */}
      {coureurs.length === 0 ? (
        <MobileEmptyState
          icon={<User className="h-12 w-12" />}
          title={t('noRiders')}
          description={t('noRidersDescription')}
        />
      ) : (
        <div className="space-y-3">
          {sortedCoureurs.map((coureur) => (
            <MobileCard
              key={coureur.coureur_id}
              title={
                <div className="flex items-center gap-1.5">
                  {bonusesEnabled && bonusRiderSelection?.coureur_id === coureur.coureur_id && (
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  )}
                  <span className="truncate">{coureur.nom}</span>
                  <RiderRaceIcons 
                    currentRaces={filteredRacesData?.races_by_rider?.[coureur.coureur_id]?.current_races}
                    upcomingRaces={filteredRacesData?.races_by_rider?.[coureur.coureur_id]?.upcoming_races}
                  />
                </div>
              }
              subtitle={
                <span className="text-xs text-muted-foreground">
                  {coureur.equipe} • {coureur.prix_achat.toFixed(0)}
                  {coureur.winning_round && <span className="opacity-60"> (R{coureur.winning_round})</span>}
                  {' / '}{coureur.cote_initiale.toFixed(0)}
                </span>
              }
              className="py-2.5"
              badge={
                <span className="font-bold text-base text-primary">
                  {coureur.points_total} pts
                </span>
              }
              onClick={() => openCoureurDetail(coureur)}
            />
          ))}
        </div>
      )}

      {/* Bonus Rider Selection Dialog */}
      {bonusesEnabled && (
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
      )}

      {/* Bonus Details Dialog */}
      <BonusPointsDetailDialog
        open={bonusDetailsOpen}
        onOpenChange={setBonusDetailsOpen}
        managerId={selectedManagerId || currentUserId || ''}
        managerName={
          selectedManagerId && selectedManagerId !== currentUserId
            ? managers.find(m => m.id === selectedManagerId)?.nom || ''
            : t('myTeam')
        }
        phaseId={selectedPhaseId}
        leagueId={leagueId}
      />

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
        leagueId={leagueId}
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

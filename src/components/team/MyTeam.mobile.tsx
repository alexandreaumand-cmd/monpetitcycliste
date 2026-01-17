import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChipGroup,
  MobileCard,
  KPIRow,
  MobileEmptyState,
} from "@/components/mobile";
import { RiderPointsDetail } from "./RiderPointsDetail";
import { RiderSearchBar } from "./RiderSearchBar";
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
} from "lucide-react";
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


type SortBy = "points" | "ratio" | "prix" | "cote";

interface Manager {
  id: string;
  nom: string;
}

export const MyTeamMobile = () => {
  const { phases, activePhase, selectedSeason } = useSeasonContext();
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const [coureurs, setCoureurs] = useState<Coureur[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("points");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  
  // Manager selection state
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Detail drawer
  const [selectedRider, setSelectedRider] = useState<{ id: string; nom: string; equipe: string; prix: number } | null>(null);
  
  // KPIs state
  const [kpis, setKpis] = useState({ 
    scorers_count: 0, 
    total_points: 0, 
    bonus_points: 0, 
    bonus_rider_points: 0,
    total_with_bonus: 0 
  });
  
  // Bonus rider state
  const [bonusRiderSelection, setBonusRiderSelection] = useState<{ coureur_id: string; coureur_nom: string } | null>(null);
  const [hasSelectedBonusRider, setHasSelectedBonusRider] = useState(false);
  const [showBonusRiderDialog, setShowBonusRiderDialog] = useState(false);
  
  // Bonus details dialog
  const [bonusDetailsOpen, setBonusDetailsOpen] = useState(false);
  
  // Get manager sponsor for jersey display
  const displayedManagerId = selectedManagerId || currentUserId;
  const { data: managerSponsor } = useManagerSponsor(displayedManagerId, selectedSeason?.id);

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
      loadTeamWithKpis();
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



  const openCoureurDetail = (coureur: Coureur) => {
    setSelectedRider({
      id: coureur.coureur_id,
      nom: coureur.nom,
      equipe: coureur.equipe,
      prix: coureur.prix_achat
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
      default:
        return 0;
    }
  });

  const getRatioColor = (ratio: number) => {
    if (ratio > 10) return "text-green-600";
    if (ratio >= 4) return "text-green-500";
    if (ratio >= 2) return "text-yellow-500";
    if (ratio > 0) return "text-orange-500";
    return "text-red-500";
  };

  const getRatioBgColor = (ratio: number) => {
    if (ratio > 10) return "bg-green-500/10 border-green-500/20";
    if (ratio >= 4) return "bg-green-500/5 border-green-500/10";
    if (ratio >= 2) return "bg-yellow-500/5 border-yellow-500/10";
    if (ratio > 0) return "bg-orange-500/5 border-orange-500/10";
    return "bg-red-500/5 border-red-500/10";
  };

  const getPhaseLabel = (phase: any) => {
    return `Phase ${phase.index_dans_saison}${phase.statut === "active" ? " ✓" : ""}`;
  };

  const sortChips = [
    { label: "Points", value: "points" as SortBy },
    { label: "Ratio", value: "ratio" as SortBy },
    { label: "Prix", value: "prix" as SortBy },
    { label: "Cote", value: "cote" as SortBy },
  ];

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

      toast.success(`✅ ${coureur_nom} recevra désormais +25% de points bonus`);

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
            <Select value={selectedPhaseId || ""} onValueChange={setSelectedPhaseId}>
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
      </div>

      {/* Barre de recherche de coureur */}
      {leagueId && selectedPhaseId && (
        <RiderSearchBar
          phaseId={selectedPhaseId}
          leagueId={leagueId}
          onSelectManager={(managerId) => {
            setSelectedManagerId(managerId);
          }}
        />
      )}

      {/* KPIs compacts */}
      <KPIRow
        items={[
          { label: "Points", value: kpis.total_points, icon: <Trophy className="h-4 w-4" /> },
          { label: "Bonus", value: kpis.bonus_points, icon: <Star className="h-4 w-4" />, onClick: () => setBonusDetailsOpen(true) },
          { label: "Scoreurs", value: `${kpis.scorers_count}/${coureurs.length}`, icon: <TrendingUp className="h-4 w-4" /> },
        ]}
      />

      {/* Bouton Choisir coureur bonus */}
      {!hasSelectedBonusRider && !selectedManagerId && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowBonusRiderDialog(true)}
          className="w-full gap-2"
        >
          <Star className="h-4 w-4" />
          Choisir coureur bonus
        </Button>
      )}


      {/* Sort chips */}
      <ChipGroup items={sortChips} selected={sortBy} onSelect={(v) => setSortBy(v as SortBy)} />

      {/* Coureurs list */}
      {coureurs.length === 0 ? (
        <MobileEmptyState
          icon={<User className="h-12 w-12" />}
          title="Aucun coureur"
          description="Vous n'avez pas encore de coureurs dans votre équipe"
        />
      ) : (
        <div className="space-y-3">
          {sortedCoureurs.map((coureur) => (
            <MobileCard
              key={coureur.coureur_id}
              title={
                <div className="flex items-center gap-1">
                  {bonusRiderSelection?.coureur_id === coureur.coureur_id && (
                    <Star className="h-4 w-4 text-[#FFD500] fill-[#FFD500]" />
                  )}
                  {coureur.nom}
                </div>
              }
              subtitle={coureur.equipe}
              meta={
                <span className="flex items-center flex-wrap gap-x-1">
                  {coureur.prix_achat.toFixed(0)}
                  {coureur.winning_round && (
                    <span className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground/70">
                      R{coureur.winning_round}
                    </span>
                  )}
                  {' / '}{coureur.cote_initiale.toFixed(0)}
                  {' • '}Ratio: {formatROICompact(computeRiderROI({
                    pointsTotal: coureur.points_total,
                    purchasePriceTotal: coureur.prix_achat
                  }))}
                </span>
              }
              className="p-3"
              badge={
                <div className="flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="font-bold text-lg">{coureur.points_total}</span>
                </div>
              }
              onClick={() => openCoureurDetail(coureur)}
            />
          ))}
        </div>
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
              .filter(c => c.prix_achat === 10 || c.prix_achat === 20)
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

      {/* Bonus Details Dialog */}
      <BonusPointsDetailDialog
        open={bonusDetailsOpen}
        onOpenChange={setBonusDetailsOpen}
        managerId={selectedManagerId || currentUserId || ''}
        managerName={
          selectedManagerId && selectedManagerId !== currentUserId
            ? managers.find(m => m.id === selectedManagerId)?.nom || ''
            : 'Mon équipe'
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
        phaseId={selectedPhaseId || ''}
      />
    </div>
  );
};

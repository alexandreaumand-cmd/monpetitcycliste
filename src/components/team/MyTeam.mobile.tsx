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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  User,
  DollarSign,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeasonContext } from "@/contexts/SeasonContext";

interface Coureur {
  coureur_id: string;
  nom: string;
  equipe: string;
  prix_achat: number;
  cote_initiale: number;
  points_total: number;
  ratio_points_par_prix: number;
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

  useEffect(() => {
    loadManagers();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (activePhase) {
      setSelectedPhaseId(activePhase.id);
    }
  }, [activePhase]);


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
    try {
      const { data: managersData } = await supabase
        .from('managers')
        .select('id, nom')
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
    const debut = new Date(phase.date_debut).toLocaleDateString("fr-FR", { month: "short" });
    const fin = new Date(phase.date_fin).toLocaleDateString("fr-FR", { month: "short" });
    return `Phase ${phase.index_dans_saison} (${debut} - ${fin})${
      phase.statut === "active" ? " ✓" : ""
    }`;
  };

  const sortChips = [
    { label: "Points", value: "points" as SortBy },
    { label: "Ratio", value: "ratio" as SortBy },
    { label: "Prix", value: "prix" as SortBy },
    { label: "Cote", value: "cote" as SortBy },
  ];

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const [kpis, setKpis] = useState({ 
    scorers_count: 0, 
    total_points: 0, 
    bonus_points: 0, 
    total_with_bonus: 0 
  });

  useEffect(() => {
    if (selectedPhaseId) {
      loadTeamWithKpis();
    }
  }, [selectedPhaseId, selectedManagerId]);

  const loadTeamWithKpis = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("manager-my-team", {
        body: { 
          phase_id: selectedPhaseId,
          manager_id: selectedManagerId 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setCoureurs(data.coureurs || []);
      setKpis(data.kpis || { scorers_count: 0, total_points: 0, bonus_points: 0, total_with_bonus: 0 });
    } catch (error: any) {
      toast.error("Erreur : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Manager selector */}
      {managers.length > 0 && (
        <div>
          <label className="text-sm font-medium mb-2 block">Manager</label>
          <Select value={selectedManagerId || '__MY_TEAM__'} onValueChange={(v) => setSelectedManagerId(v === '__MY_TEAM__' ? null : v)}>
            <SelectTrigger>
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
        </div>
      )}
      
      {/* Phase selector */}
      {phases.length > 0 && (
        <div>
          <label className="text-sm font-medium mb-2 block">Phase</label>
          <Select value={selectedPhaseId || ""} onValueChange={setSelectedPhaseId}>
            <SelectTrigger>
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
        </div>
      )}

      {/* KPIs */}
      <div className="space-y-2">
        <KPIRow
          items={[
            { label: "Points totaux", value: kpis.total_with_bonus, icon: <Trophy className="h-4 w-4" /> },
            { label: "Bonus", value: kpis.bonus_points, icon: <span className="text-sm">🎁</span> },
            { label: "Scoreurs", value: kpis.scorers_count, icon: <Trophy className="h-4 w-4" />, trend: kpis.scorers_count > 0 ? "up" : "neutral" },
          ]}
        />
      </div>

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
              title={coureur.nom}
              subtitle={coureur.equipe}
              meta={`Prix: ${coureur.prix_achat.toFixed(0)} • Cote: ${coureur.cote_initiale.toFixed(0)}`}
              className={getRatioBgColor(coureur.ratio_points_par_prix)}
              avatar={
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10">
                    {coureur.nom
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              }
              badge={
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="font-bold text-lg">{coureur.points_total}</span>
                  </div>
                  <div
                    className={`flex items-center gap-1 justify-end font-semibold text-sm ${getRatioColor(
                      coureur.ratio_points_par_prix
                    )}`}
                  >
                    {coureur.ratio_points_par_prix > 1 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : coureur.ratio_points_par_prix < 1 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : null}
                    <span>{coureur.ratio_points_par_prix.toFixed(2)}</span>
                  </div>
                </div>
              }
              onClick={() => openCoureurDetail(coureur)}
            />
          ))}
        </div>
      )}

      {/* Rider Points Detail */}
      <RiderPointsDetail
        isOpen={!!selectedRider}
        onClose={() => setSelectedRider(null)}
        riderId={selectedRider?.id || ''}
        riderName={selectedRider?.nom || ''}
        riderTeam={selectedRider?.equipe || ''}
        riderPrice={selectedRider?.prix || 0}
        phaseId={selectedPhaseId || ''}
        managerId={selectedManagerId || currentUserId || undefined}
      />
    </div>
  );
};

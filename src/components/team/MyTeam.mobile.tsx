import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChipGroup,
  MobileCard,
  MobileBottomSheet,
  KPIRow,
  MobileEmptyState,
} from "@/components/mobile";
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

interface Phase {
  id: string;
  index_dans_saison: number;
  date_debut: string;
  date_fin: string;
  statut: "draft" | "active" | "completed" | "auction_open" | "auction_closed";
}

type SortBy = "points" | "ratio" | "prix" | "cote";

interface Manager {
  id: string;
  nom: string;
}

export const MyTeamMobile = () => {
  const [coureurs, setCoureurs] = useState<Coureur[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("points");
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  
  // Manager selection state
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Detail drawer
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCoureur, setSelectedCoureur] = useState<Coureur | null>(null);
  const [pointsDetail, setPointsDetail] = useState<PointDetail[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadPhases();
    loadManagers();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (selectedPhaseId) {
      loadTeam();
    }
  }, [selectedPhaseId]);

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

  const loadPhases = async () => {
    try {
      const { data: saisonData } = await supabase
        .from("saisons")
        .select("id")
        .eq("annee", 2025)
        .single();

      if (!saisonData) return;

      const { data: phasesData } = await supabase
        .from("phases")
        .select("*")
        .eq("saison_id", saisonData.id)
        .order("index_dans_saison", { ascending: false });

      if (phasesData && phasesData.length > 0) {
        setPhases(phasesData);
        const activePhase = phasesData.find((p) => p.statut === "active");
        setSelectedPhaseId(activePhase?.id || phasesData[0].id);
      }
    } catch (error) {
      console.error("Error loading phases:", error);
    }
  };

  const loadTeam = async () => {
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
    } catch (error: any) {
      toast.error("Erreur : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openCoureurDetail = async (coureur: Coureur) => {
    setSelectedCoureur(coureur);
    setDetailsOpen(true);
    setLoadingDetail(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke(
        "manager-coureur-points-detail",
        {
          body: { coureur_id: coureur.coureur_id, phase_id: selectedPhaseId },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;
      setPointsDetail(data.history || []);
    } catch (error) {
      toast.error("Impossible de charger les détails");
    } finally {
      setLoadingDetail(false);
    }
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

  const getPhaseLabel = (phase: Phase) => {
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

  const scorersCount = coureurs.filter((c) => c.points_total > 0).length;
  const totalPoints = coureurs.reduce((sum, c) => sum + c.points_total, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Manager selector */}
      {managers.length > 0 && (
        <div>
          <label className="text-sm font-medium mb-2 block">Manager</label>
          <Select value={selectedManagerId || ""} onValueChange={setSelectedManagerId}>
            <SelectTrigger>
              <SelectValue placeholder="Mon équipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Mon équipe</SelectItem>
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
      <KPIRow
        items={[
          { label: "Coureurs", value: coureurs.length, icon: <User className="h-4 w-4" /> },
          { label: "Scoreurs", value: scorersCount, icon: <Trophy className="h-4 w-4" />, trend: scorersCount > 0 ? "up" : "neutral" },
          { label: "Points", value: totalPoints, icon: <Trophy className="h-4 w-4" /> },
        ]}
      />

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

      {/* Detail bottom sheet */}
      <MobileBottomSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title={selectedCoureur?.nom || "Détails"}
        description={selectedCoureur?.equipe}
      >
        {selectedCoureur && (
          <div className="space-y-4">
            <KPIRow
              items={[
                { label: "Points", value: selectedCoureur.points_total, icon: <Trophy className="h-4 w-4" /> },
                { label: "Ratio", value: selectedCoureur.ratio_points_par_prix.toFixed(2) },
                { label: "Prix", value: selectedCoureur.prix_achat.toFixed(0), icon: <DollarSign className="h-4 w-4" /> },
              ]}
            />

            <div>
              <h3 className="font-semibold mb-3">Historique des points</h3>
              
              {loadingDetail ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : pointsDetail.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucun point marqué
                </div>
              ) : (
                <div className="space-y-2">
                  {pointsDetail.map((detail, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-muted/50 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{detail.course_nom}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                          <Badge variant="outline" className="text-xs">{detail.type_classement}</Badge>
                          {detail.etape_numero && <span>Étape {detail.etape_numero}</span>}
                          <span>{new Date(detail.date_classement).toLocaleDateString("fr-FR")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-lg text-primary">
                        <Trophy className="h-4 w-4" />
                        {detail.points}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
};

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, Trophy } from "lucide-react";
import { computeRiderROI, formatROICompact } from "@/domain/stats/roi";

interface LeagueBonusRidersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string | null;
  phaseId: string | null;
}

interface BonusRiderInfo {
  manager_id: string;
  manager_nom: string;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  prix_achat: number;
  points_total: number;
  bonus_points: number;
  ratio: number;
}

export function LeagueBonusRidersDialog({
  open,
  onOpenChange,
  leagueId,
  phaseId,
}: LeagueBonusRidersDialogProps) {
  const { t } = useTranslation("team");

  const { data: bonusRiders = [], isLoading } = useQuery({
    queryKey: ["league-bonus-riders", leagueId, phaseId],
    queryFn: async () => {
      if (!leagueId || !phaseId) return [];

      const { data: selections, error: selectionsError } = await supabase
        .from("bonus_rider_selections")
        .select(`
          manager_id,
          coureur_id,
          managers!inner(nom)
        `)
        .eq("league_id", leagueId)
        .eq("phase_id", phaseId);

      if (selectionsError) throw selectionsError;
      if (!selections || selections.length === 0) return [];

      const coureurIds = selections.map((s) => s.coureur_id);
      const managerIds = selections.map((s) => s.manager_id);

      const { data: rosterData, error: rosterError } = await supabase
        .from("rosters")
        .select(`
          manager_id,
          coureur_id,
          prix_signature,
          coureurs!inner(nom)
        `)
        .eq("league_id", leagueId)
        .eq("phase_id", phaseId)
        .in("coureur_id", coureurIds)
        .in("manager_id", managerIds);

      if (rosterError) throw rosterError;

      const { data: saisonData } = await supabase
        .from("phases")
        .select("saison_id")
        .eq("id", phaseId)
        .single();

      const saisonId = saisonData?.saison_id;
      let coureursTeamData: Record<string, string> = {};

      if (saisonId) {
        const { data: csData } = await supabase
          .from("coureurs_saisons")
          .select("coureur_id, equipe_id")
          .eq("saison_id", saisonId)
          .in("coureur_id", coureurIds);

        if (csData) {
          const equipeIds = [...new Set(csData.map(cs => cs.equipe_id).filter(Boolean))] as string[];
          let equipeNoms: Record<string, string> = {};
          if (equipeIds.length > 0) {
            const { data: esData } = await supabase
              .from("equipes_saisons")
              .select("equipe_id, nom_affiche")
              .eq("saison_id", saisonId)
              .in("equipe_id", equipeIds);
            if (esData) {
              esData.forEach(es => {
                equipeNoms[es.equipe_id] = es.nom_affiche || "";
              });
            }
          }
          csData.forEach((cs) => {
            coureursTeamData[cs.coureur_id] = cs.equipe_id ? equipeNoms[cs.equipe_id] || "" : "";
          });
        }
      }

      // Get league-scoped course IDs
      const { data: leagueCourseIdsData } = await supabase.rpc('get_league_course_ids', { p_league_id: leagueId });
      const validCourseIds = (leagueCourseIdsData as any[])?.map((r: any) => r.course_id) || [];

      const { data: leagueData } = await supabase
        .from("leagues")
        .select("started_at_effective")
        .eq("id", leagueId)
        .single();

      let scopedCourseIds = validCourseIds;
      if (leagueData?.started_at_effective && validCourseIds.length > 0) {
        const dateFloor = (leagueData.started_at_effective as string).substring(0, 10);
        const { data: coursesData } = await supabase
          .from("courses")
          .select("id, date_debut")
          .in("id", validCourseIds);
        scopedCourseIds = (coursesData || [])
          .filter(c => c.date_debut && c.date_debut > dateFloor)
          .map(c => c.id);
      }

      if (scopedCourseIds.length === 0) {
        return result.sort((a, b) => b.points_total - a.points_total);
      }

      const { data: pointsData } = await supabase
        .from("points_ledger")
        .select("coureur_id, points")
        .eq("phase_id", phaseId)
        .in("coureur_id", coureurIds)
        .in("course_id", scopedCourseIds);

      const pointsByRider: Record<string, number> = {};
      if (pointsData) {
        pointsData.forEach((p) => {
          if (p.coureur_id) {
            pointsByRider[p.coureur_id] = (pointsByRider[p.coureur_id] || 0) + p.points;
          }
        });
      }

      // Get bonus points earned per rider (scoped to league courses)
      const { data: bonusData } = await supabase
        .from("bonus_points")
        .select("coureur_id, points")
        .eq("phase_id", phaseId)
        .in("bonus_type", ["first_win", "coureur_bonuse", "itt"])
        .in("coureur_id", coureurIds)
        .in("course_id", scopedCourseIds);

      const bonusByRider: Record<string, number> = {};
      if (bonusData) {
        bonusData.forEach((b) => {
          if (b.coureur_id) {
            bonusByRider[b.coureur_id] = (bonusByRider[b.coureur_id] || 0) + b.points;
          }
        });
      }

      const result: BonusRiderInfo[] = selections.map((s) => {
        const roster = rosterData?.find(
          (r) => r.manager_id === s.manager_id && r.coureur_id === s.coureur_id
        );
        const managerNom = (s.managers as any)?.nom || "Inconnu";
        const coureurNom = roster?.coureurs?.nom || "Inconnu";
        const equipe = coureursTeamData[s.coureur_id] || "";
        const prixAchat = roster?.prix_signature || 0;
        const pointsTotal = pointsByRider[s.coureur_id] || 0;
        const bonusPoints = bonusByRider[s.coureur_id] || 0;
        const ratio = computeRiderROI({
          pointsTotal,
          purchasePriceTotal: prixAchat,
        });

        return {
          manager_id: s.manager_id,
          manager_nom: managerNom,
          coureur_id: s.coureur_id,
          coureur_nom: coureurNom,
          equipe,
          prix_achat: prixAchat,
          points_total: pointsTotal,
          bonus_points: bonusPoints,
          ratio,
        };
      });

      return result.sort((a, b) => b.points_total - a.points_total);
    },
    enabled: open && !!leagueId && !!phaseId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-bordure-gold fill-bordure-gold" />
            {t("bonusRider.othersTitle")}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : bonusRiders.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            {t("bonusRider.noData")}
          </p>
        ) : (
          <div className="space-y-2">
            {bonusRiders.map((rider) => (
              <div
                key={rider.manager_id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                {/* Left: manager + rider info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{rider.manager_nom}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="h-3 w-3 shrink-0 text-bordure-gold fill-bordure-gold" />
                    <span className="text-xs truncate" title={rider.coureur_nom}>{rider.coureur_nom}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate" title={rider.equipe}>
                    {rider.equipe}
                  </div>
                </div>

                {/* Right: stats */}
                <div className="shrink-0 text-right space-y-0.5">
                  <div className="flex items-center justify-end gap-1">
                    <Trophy className="h-3 w-3 text-primary" />
                    <span className="font-bold text-sm">{Number(rider.points_total.toFixed(2))}</span>
                  </div>
                  {rider.bonus_points > 0 && (
                    <div className="text-[11px] text-green-500 font-medium">
                      +{rider.bonus_points.toFixed(1)} bonus
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    <span>{rider.prix_achat.toFixed(0)}M</span>
                    <Badge
                      variant={rider.ratio > 1 ? "default" : "secondary"}
                      className={`text-[10px] px-1.5 py-0 ${rider.ratio > 1 ? "bg-green-600" : ""}`}
                    >
                      {formatROICompact(rider.ratio)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

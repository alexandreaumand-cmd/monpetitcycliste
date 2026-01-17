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
  cote_initiale: number;
  points_total: number;
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

      // Get all bonus rider selections for this phase and league
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

      // Get rider details from rosters
      const coureurIds = selections.map((s) => s.coureur_id);
      const managerIds = selections.map((s) => s.manager_id);

      const { data: rosterData, error: rosterError } = await supabase
        .from("rosters")
        .select(`
          manager_id,
          coureur_id,
          prix_signature,
          coureurs!inner(nom, equipe)
        `)
        .eq("league_id", leagueId)
        .eq("phase_id", phaseId)
        .in("coureur_id", coureurIds)
        .in("manager_id", managerIds);

      if (rosterError) throw rosterError;

      // Get initial ratings from coureurs_saisons
      const { data: saisonData } = await supabase
        .from("phases")
        .select("saison_id")
        .eq("id", phaseId)
        .single();

      const saisonId = saisonData?.saison_id;
      let coureursInitialData: Record<string, number> = {};

      if (saisonId) {
        const { data: csData } = await supabase
          .from("coureurs_saisons")
          .select("coureur_id, prix_initial")
          .eq("saison_id", saisonId)
          .in("coureur_id", coureurIds);

        if (csData) {
          coureursInitialData = csData.reduce((acc, cs) => {
            acc[cs.coureur_id] = cs.prix_initial ?? 0;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Get points for each rider in this phase
      const { data: pointsData } = await supabase
        .from("points_ledger")
        .select("coureur_id, points")
        .eq("phase_id", phaseId)
        .in("coureur_id", coureurIds);

      const pointsByRider: Record<string, number> = {};
      if (pointsData) {
        pointsData.forEach((p) => {
          if (p.coureur_id) {
            pointsByRider[p.coureur_id] = (pointsByRider[p.coureur_id] || 0) + p.points;
          }
        });
      }

      // Build the result
      const result: BonusRiderInfo[] = selections.map((s) => {
        const roster = rosterData?.find(
          (r) => r.manager_id === s.manager_id && r.coureur_id === s.coureur_id
        );
        const managerNom = (s.managers as any)?.nom || "Inconnu";
        const coureurNom = roster?.coureurs?.nom || "Inconnu";
        const equipe = roster?.coureurs?.equipe || "";
        const prixAchat = roster?.prix_signature || 0;
        const coteInitiale = coureursInitialData[s.coureur_id] || 0;
        const pointsTotal = pointsByRider[s.coureur_id] || 0;
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
          cote_initiale: coteInitiale,
          points_total: pointsTotal,
          ratio,
        };
      });

      // Sort by points descending
      return result.sort((a, b) => b.points_total - a.points_total);
    },
    enabled: open && !!leagueId && !!phaseId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[#FFD500] fill-[#FFD500]" />
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">{t("bonusRider.manager")}</th>
                  <th className="text-left p-2">{t("bonusRider.rider")}</th>
                  <th className="text-right p-2">{t("price")}</th>
                  <th className="text-right p-2">{t("rating")}</th>
                  <th className="text-right p-2">{t("points")}</th>
                  <th className="text-right p-2">{t("ratio")}</th>
                </tr>
              </thead>
              <tbody>
                {bonusRiders.map((rider) => (
                  <tr key={rider.manager_id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium truncate max-w-[100px]">
                      {rider.manager_nom}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-[#FFD500] fill-[#FFD500]" />
                        <span className="truncate max-w-[120px]">{rider.coureur_nom}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {rider.equipe}
                      </div>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {rider.prix_achat.toFixed(0)}
                    </td>
                    <td className="p-2 text-right">
                      <Badge variant="outline">{rider.cote_initiale}</Badge>
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Trophy className="h-3 w-3 text-primary" />
                        <span className="font-bold">{rider.points_total}</span>
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <Badge
                        variant={rider.ratio > 1 ? "default" : "secondary"}
                        className={rider.ratio > 1 ? "bg-green-600" : ""}
                      >
                        {formatROICompact(rider.ratio)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

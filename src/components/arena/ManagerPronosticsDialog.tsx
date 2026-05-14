import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { useManagerWinningPronostics } from "@/hooks/useArenaPronostics";

interface ManagerPronosticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  managerId: string | null;
  managerNom: string;
  courseId?: string | null;
}

export const ManagerPronosticsDialog = ({
  open,
  onOpenChange,
  leagueId,
  managerId,
  managerNom,
  courseId,
}: ManagerPronosticsDialogProps) => {
  const { t } = useTranslation("arena");
  const { data, isLoading } = useManagerWinningPronostics(
    leagueId,
    managerId,
    courseId,
    open,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-bordure-gold" />
            {t("pronostics.standings.managerDetailTitle", { name: managerNom })}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("pronostics.standings.winningEmpty")}
          </p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {data.map((p) => (
              <div
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-md border bg-card p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.course_nom}
                    {p.etape_numero ? ` — É${p.etape_numero}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(`pronostics.types.${typeKey(p.pronostic_type)}`, {
                      defaultValue: p.pronostic_type,
                    })}
                  </div>
                  <div className="text-sm mt-1 truncate">
                    {p.coureur_nom || p.equipe_nom || "—"}
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {t("pronostics.status.correct")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

function typeKey(t: string): string {
  switch (t) {
    case "stage_winner":
      return "stageWinner";
    case "gc_winner":
      return "gcWinner";
    case "one_day_winner":
      return "oneDayWinner";
    default:
      return t;
  }
}

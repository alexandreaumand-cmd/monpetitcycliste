import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Clock, Lock, Target } from "lucide-react";
import { PronosticStartlistCombobox } from "./PronosticStartlistCombobox";
import { useSavePronostic, type PronosticDeadline, type MyPronostic } from "@/hooks/useArenaPronostics";
import { toast } from "sonner";
import { formatDistanceToNow, isPast } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useTranslation as useI18n } from "react-i18next";

interface PronosticRaceCardProps {
  deadline: PronosticDeadline;
  pronostic: MyPronostic | null;
  leagueId: string;
  managerId: string;
}

export const PronosticRaceCard = ({
  deadline,
  pronostic,
  leagueId,
  managerId,
}: PronosticRaceCardProps) => {
  const { t, i18n } = useTranslation("arena");
  const dateLocale = i18n.language === "fr" ? fr : enUS;
  const savePronostic = useSavePronostic();

  const isExpired = isPast(new Date(deadline.deadline_at));
  const isEvaluated = pronostic?.is_correct !== null && pronostic?.is_correct !== undefined;

  const typeLabel = useMemo(() => {
    switch (deadline.pronostic_type) {
      case "stage_winner":
        return `${t("pronostics.types.stageWinner")} ${deadline.etape_numero ? `#${deadline.etape_numero}` : ""}`;
      case "gc_winner":
        return t("pronostics.types.gcWinner");
      case "one_day_winner":
        return t("pronostics.types.oneDayWinner");
      default:
        return deadline.pronostic_type;
    }
  }, [deadline, t]);

  const statusInfo = useMemo(() => {
    if (isEvaluated && pronostic) {
      return pronostic.is_correct
        ? { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", label: t("pronostics.status.correct") }
        : { icon: XCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", label: t("pronostics.status.incorrect") };
    }
    if (isExpired) {
      return { icon: Lock, color: "text-muted-foreground", bg: "bg-muted/50", label: t("pronostics.status.closed") };
    }
    return { icon: Clock, color: "text-primary", bg: "bg-primary/5", label: t("pronostics.status.open") };
  }, [isEvaluated, isExpired, pronostic, t]);

  const handleSelect = async (coureurId: string, coureurNom: string) => {
    try {
      await savePronostic.mutateAsync({
        leagueId,
        managerId,
        courseId: deadline.course_id,
        etapeNumero: deadline.etape_numero,
        pronosticType: deadline.pronostic_type,
        coureurId,
      });
      toast.success(t("pronostics.saved", { rider: coureurNom }));
    } catch (error: any) {
      console.error("Error saving pronostic:", error);
      toast.error(t("pronostics.saveError"));
    }
  };

  const StatusIcon = statusInfo.icon;

  return (
    <Card className={`transition-all ${statusInfo.bg}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Course + Type */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">
              {deadline.courses?.nom || deadline.course_id}
            </h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {typeLabel}
              </Badge>
              {deadline.courses?.categorie && (
                <Badge variant="secondary" className="text-xs">
                  {deadline.courses.categorie}
                </Badge>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
            <StatusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{statusInfo.label}</span>
          </div>
        </div>

        {/* Deadline info */}
        <div className="text-xs text-muted-foreground">
          <Clock className="h-3 w-3 inline mr-1" />
          {isExpired
            ? t("pronostics.deadlineExpired", {
                time: formatDistanceToNow(new Date(deadline.deadline_at), {
                  addSuffix: true,
                  locale: dateLocale,
                }),
              })
            : t("pronostics.deadlineIn", {
                time: formatDistanceToNow(new Date(deadline.deadline_at), {
                  addSuffix: false,
                  locale: dateLocale,
                }),
              })}
        </div>

        {/* Rider selection or result */}
        {!isExpired ? (
          <div>
            <PronosticStartlistCombobox
              courseId={deadline.course_id}
              value={pronostic?.coureur_id || null}
              onSelect={handleSelect}
              disabled={savePronostic.isPending}
            />
            {savePronostic.isPending && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("pronostics.saving")}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm">
            {pronostic ? (
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span>
                  {t("pronostics.yourPick")}: <strong>{pronostic.coureur_nom}</strong>
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground italic">{t("pronostics.noPick")}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

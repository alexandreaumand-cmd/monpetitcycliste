import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, CheckCircle, XCircle, Clock, Lock, Target, ArrowRight, Users } from "lucide-react";
import { PronosticStartlistCombobox } from "./PronosticStartlistCombobox";
import { useSavePronostic, useLeaguePronostics, type PronosticDeadline, type MyPronostic } from "@/hooks/useArenaPronostics";
import { toast } from "sonner";
import { formatDistanceToNow, isPast } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

  const deadlineText = isExpired
    ? t("pronostics.deadlineExpired", {
        time: formatDistanceToNow(new Date(deadline.deadline_at), { addSuffix: true, locale: dateLocale }),
      })
    : t("pronostics.deadlineIn", {
        time: formatDistanceToNow(new Date(deadline.deadline_at), { addSuffix: false, locale: dateLocale }),
      });

  return (
    <Card className={`transition-all ${statusInfo.bg}`}>
      <CardContent className="p-3 space-y-1.5">
        {/* Line 1: Course name + badges + status */}
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm truncate flex-1 min-w-0">
            {deadline.courses?.nom || deadline.course_id}
          </h4>
          <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0">
            {typeLabel}
          </Badge>
          {deadline.courses?.categorie && (
            <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0">
              {deadline.courses.categorie}
            </Badge>
          )}
          <div className={`flex items-center shrink-0 ${statusInfo.color}`}>
            <StatusIcon className="h-4 w-4" />
          </div>
        </div>

        {/* Line 2: Deadline + rider selector or result */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{deadlineText}</span>
          </div>
          <div className="flex-1 min-w-0">
            {!isExpired ? (
              <div className="flex items-center gap-1">
                <PronosticStartlistCombobox
                  courseId={deadline.course_id}
                  value={pronostic?.coureur_id || null}
                  onSelect={handleSelect}
                  disabled={savePronostic.isPending}
                />
                {savePronostic.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>
            ) : pronostic ? (
              <div className="flex items-center gap-1 text-sm justify-end">
                <Target className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate font-medium">{pronostic.coureur_nom}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic text-right block">{t("pronostics.noPick")}</span>
            )}
          </div>
        </div>

        {/* Collapsible all picks (closed state only) */}
        {isExpired && (
          <ClosedPronosticsList
            leagueId={leagueId}
            deadline={deadline}
            pronostic={pronostic}
            managerId={managerId}
            isExpired={isExpired}
            t={t}
          />
        )}
      </CardContent>
    </Card>
  );
};

// Sub-component for the closed state showing all managers' picks (collapsed by default)
const ClosedPronosticsList = ({
  leagueId,
  deadline,
  pronostic,
  managerId,
  isExpired,
  t,
}: {
  leagueId: string;
  deadline: PronosticDeadline;
  pronostic: MyPronostic | null;
  managerId: string;
  isExpired: boolean;
  t: (key: string) => string;
}) => {
  const { data: allPicks, isLoading } = useLeaguePronostics(
    leagueId,
    deadline.course_id,
    deadline.etape_numero,
    deadline.pronostic_type,
    isExpired
  );

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="picks" className="border-0">
        <AccordionTrigger className="py-1 hover:no-underline text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {t("pronostics.allPicks")}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          {isLoading ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : !allPicks || allPicks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t("pronostics.noPicksYet")}</p>
          ) : (
            <div className="space-y-1">
              {allPicks.map((pick) => {
                const isCurrentUser = pick.manager_id === managerId;
                return (
                  <div
                    key={pick.manager_id}
                    className={cn(
                      "flex items-center gap-2 py-1 px-2 rounded-md text-sm",
                      isCurrentUser && "bg-primary/10 ring-1 ring-primary/20"
                    )}
                  >
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={pick.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px]">
                        {pick.manager_nom.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate text-xs">
                      {pick.manager_nom}
                      {isCurrentUser && (
                        <span className="text-[10px] text-muted-foreground ml-1">{t("pronostics.you")}</span>
                      )}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1 text-xs">{pick.coureur_nom}</span>
                    {pick.is_correct !== null && (
                      pick.is_correct ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

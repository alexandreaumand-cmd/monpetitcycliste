import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, CheckCircle, XCircle, Clock, Lock, Target, ArrowRight, Users } from "lucide-react";
import { PronosticStartlistCombobox } from "./PronosticStartlistCombobox";
import { PronosticStartlistTeamCombobox } from "./PronosticStartlistTeamCombobox";
import { useSavePronostic, useLeaguePronostics, type PronosticDeadline, type MyPronostic } from "@/hooks/useArenaPronostics";
import { toast } from "sonner";
import { isPast, differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks } from "date-fns";
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

function formatShortDeadline(deadline: Date, lang: string): string {
  const now = new Date();
  const mins = differenceInMinutes(deadline, now);
  if (mins < 60) return `${Math.max(1, mins)}min`;
  const hrs = differenceInHours(deadline, now);
  const remainMins = mins - hrs * 60;
  if (hrs < 24) return remainMins > 0 ? `${hrs}h${String(remainMins).padStart(2, '0')}` : `${hrs}h`;
  const days = differenceInDays(deadline, now);
  if (days < 7) return lang === 'fr' ? `${days}jrs` : `${days}d`;
  const weeks = differenceInWeeks(deadline, now);
  return lang === 'fr' ? `${weeks}sem` : `${weeks}w`;
}

export const PronosticRaceCard = ({
  deadline,
  pronostic,
  leagueId,
  managerId,
}: PronosticRaceCardProps) => {
  const { t, i18n } = useTranslation("arena");
  const lang = i18n.language?.split('-')[0] || 'fr';
  const savePronostic = useSavePronostic();

  const isExpired = isPast(new Date(deadline.deadline_at));
  const isEvaluated = pronostic?.is_correct !== null && pronostic?.is_correct !== undefined;
  const isTTT = deadline.is_ttt;

  const typeLabel = useMemo(() => {
    if (isTTT) {
      return `TTT ${deadline.etape_numero ? `#${deadline.etape_numero}` : ""}`;
    }
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
  }, [deadline, t, isTTT]);

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

  const handleSelectRider = async (coureurId: string, coureurNom: string) => {
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

  const handleSelectTeam = async (equipeSaisonId: string, equipeName: string) => {
    try {
      await savePronostic.mutateAsync({
        leagueId,
        managerId,
        courseId: deadline.course_id,
        etapeNumero: deadline.etape_numero,
        pronosticType: deadline.pronostic_type,
        equipeSaisonId,
      });
      toast.success(t("pronostics.saved", { rider: equipeName }));
    } catch (error: any) {
      console.error("Error saving pronostic:", error);
      toast.error(t("pronostics.saveError"));
    }
  };

  const StatusIcon = statusInfo.icon;
  const shortDeadline = !isExpired ? formatShortDeadline(new Date(deadline.deadline_at), lang) : null;

  // Display name for current pick
  const pickDisplayName = isTTT
    ? (pronostic?.equipe_nom || null)
    : (pronostic?.coureur_nom || null);

  return (
    <Card className={`transition-all ${statusInfo.bg}`}>
      <CardContent className="p-3 space-y-1.5">
        {/* Line 1: Course name + badges + compact deadline + status */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <h4 className="font-semibold text-sm truncate flex-1 min-w-0">
            {deadline.courses?.nom || deadline.course_id}
          </h4>
          <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0">
            {typeLabel}
          </Badge>
          {deadline.courses?.categorie && (
            <Badge variant="secondary" className="text-[10px] shrink truncate max-w-[80px] px-1.5 py-0">
              {deadline.courses.categorie}
            </Badge>
          )}
          {shortDeadline && (
            <div className="flex items-center gap-0.5 shrink-0 text-primary">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] font-medium">{shortDeadline}</span>
            </div>
          )}
          <div className={`flex items-center shrink-0 ${statusInfo.color}`}>
            <StatusIcon className="h-4 w-4" />
          </div>
        </div>

        {/* Line 2: Full-width selector or result */}
        <div>
          {!isExpired ? (
            <div className="flex items-center gap-1">
              {isTTT ? (
                <PronosticStartlistTeamCombobox
                  courseId={deadline.course_id}
                  value={pronostic?.equipe_saison_id || null}
                  onSelect={handleSelectTeam}
                  disabled={savePronostic.isPending}
                />
              ) : (
                <PronosticStartlistCombobox
                  courseId={deadline.course_id}
                  value={pronostic?.coureur_id || null}
                  onSelect={handleSelectRider}
                  disabled={savePronostic.isPending}
                />
              )}
              {savePronostic.isPending && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>
          ) : pickDisplayName ? (
            <div className="flex items-center gap-1 text-sm">
              <Target className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate font-medium">{pickDisplayName}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">{t("pronostics.noPick")}</span>
          )}
        </div>

        {/* Collapsible all picks (closed state only) */}
        {isExpired && (
          <ClosedPronosticsList
            leagueId={leagueId}
            deadline={deadline}
            pronostic={pronostic}
            managerId={managerId}
            isExpired={isExpired}
            isTTT={isTTT}
            t={t}
          />
        )}
      </CardContent>
    </Card>
  );
};

// Sub-component for the closed state showing all managers' picks
const ClosedPronosticsList = ({
  leagueId,
  deadline,
  pronostic,
  managerId,
  isExpired,
  isTTT,
  t,
}: {
  leagueId: string;
  deadline: PronosticDeadline;
  pronostic: MyPronostic | null;
  managerId: string;
  isExpired: boolean;
  isTTT: boolean;
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
                const pickName = isTTT ? pick.equipe_nom : pick.coureur_nom;
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
                    <span className="truncate flex-1 text-xs">{pickName || '—'}</span>
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

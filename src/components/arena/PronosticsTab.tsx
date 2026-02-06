import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, CheckCircle, XCircle, Clock } from "lucide-react";
import { PronosticRaceCard } from "./PronosticRaceCard";
import { PronosticStandings } from "./PronosticStandings";
import {
  useCurrentManagerId,
  usePronosticDeadlines,
  useMyPronostics,
} from "@/hooks/useArenaPronostics";
import { isPast } from "date-fns";

interface PronosticsTabProps {
  leagueId: string;
}

export const PronosticsTab = ({ leagueId }: PronosticsTabProps) => {
  const { t } = useTranslation("arena");
  const { data: managerId, isLoading: managerLoading } = useCurrentManagerId();
  const { data: deadlines, isLoading: deadlinesLoading } = usePronosticDeadlines();
  const { data: myPronostics, isLoading: pronosticsLoading } = useMyPronostics(leagueId, managerId || null);

  const isLoading = managerLoading || deadlinesLoading || pronosticsLoading;

  // Split deadlines into open and closed
  const { openDeadlines, closedDeadlines } = useMemo(() => {
    if (!deadlines) return { openDeadlines: [], closedDeadlines: [] };

    const open = deadlines.filter((d) => !isPast(new Date(d.deadline_at)));
    const closed = deadlines.filter((d) => isPast(new Date(d.deadline_at)));

    return { openDeadlines: open, closedDeadlines: closed };
  }, [deadlines]);

  // Map pronostics to deadlines
  const getPronosticForDeadline = (deadline: typeof deadlines extends (infer T)[] ? T : never) => {
    if (!myPronostics) return null;
    return myPronostics.find(
      (p) =>
        p.course_id === deadline.course_id &&
        p.pronostic_type === deadline.pronostic_type &&
        p.etape_numero === deadline.etape_numero
    ) || null;
  };

  // Stats
  const stats = useMemo(() => {
    if (!myPronostics) return { total: 0, correct: 0, incorrect: 0, pending: 0 };
    const correct = myPronostics.filter((p) => p.is_correct === true).length;
    const incorrect = myPronostics.filter((p) => p.is_correct === false).length;
    const pending = myPronostics.filter((p) => p.is_correct === null).length;
    return { total: myPronostics.length, correct, incorrect, pending };
  }, [myPronostics]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!managerId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("pronostics.noManager")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Target className="h-4 w-4 text-primary" />
            <div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t("pronostics.stats.total")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">{stats.correct}</p>
              <p className="text-xs text-muted-foreground">{t("pronostics.stats.correct")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
            <XCircle className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-lg font-bold text-red-700 dark:text-red-400">{stats.incorrect}</p>
              <p className="text-xs text-muted-foreground">{t("pronostics.stats.incorrect")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Open pronostics */}
      {openDeadlines.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {t("pronostics.sections.open")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {openDeadlines.map((deadline) => (
              <PronosticRaceCard
                key={deadline.id}
                deadline={deadline}
                pronostic={getPronosticForDeadline(deadline)}
                leagueId={leagueId}
                managerId={managerId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closed / Evaluated pronostics */}
      {closedDeadlines.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="h-4 w-4" />
            {t("pronostics.sections.closed")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {closedDeadlines.map((deadline) => (
              <PronosticRaceCard
                key={deadline.id}
                deadline={deadline}
                pronostic={getPronosticForDeadline(deadline)}
                leagueId={leagueId}
                managerId={managerId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {deadlines?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Target className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">{t("pronostics.empty")}</p>
          <p className="text-sm">{t("pronostics.emptyDesc")}</p>
        </div>
      )}

      {/* Standings */}
      <PronosticStandings leagueId={leagueId} />
    </div>
  );
};

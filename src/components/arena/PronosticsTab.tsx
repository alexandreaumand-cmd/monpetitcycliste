import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Target } from "lucide-react";
import { PronosticRaceCard } from "./PronosticRaceCard";
import { PronosticStandings } from "./PronosticStandings";
import { TabGroup } from "@/components/mobile/TabGroup";
import {
  useCurrentManagerId,
  usePronosticDeadlines,
  useMyPronostics,
  useEvaluatedDeadlineIds,
} from "@/hooks/useArenaPronostics";
import { isPast } from "date-fns";

interface PronosticsTabProps {
  leagueId: string;
}

export const PronosticsTab = ({ leagueId }: PronosticsTabProps) => {
  const { t } = useTranslation("arena");
  const [activeTab, setActiveTab] = useState("inprogress");
  const { data: managerId, isLoading: managerLoading } = useCurrentManagerId();
  const { data: deadlines, isLoading: deadlinesLoading } = usePronosticDeadlines();
  const { data: myPronostics, isLoading: pronosticsLoading } = useMyPronostics(leagueId, managerId || null);
  const { data: evaluatedIds, isLoading: evaluatedLoading } = useEvaluatedDeadlineIds(deadlines);

  const isLoading = managerLoading || deadlinesLoading || pronosticsLoading || evaluatedLoading;

  // Split deadlines into categories
  const { openDeadlines, evaluatedDeadlines, pendingDeadlines } = useMemo(() => {
    if (!deadlines) return { openDeadlines: [], evaluatedDeadlines: [], pendingDeadlines: [] };

    const open = deadlines.filter((d) => !isPast(new Date(d.deadline_at)));
    const closed = deadlines.filter((d) => isPast(new Date(d.deadline_at)));

    const evaluated: typeof closed = [];
    const pending: typeof closed = [];

    for (const d of closed) {
      const prono = myPronostics?.find(
        (p) =>
          p.course_id === d.course_id &&
          p.pronostic_type === d.pronostic_type &&
          p.etape_numero === d.etape_numero
      );

      // Case 1: Manager has a pick and it's been evaluated → Passés
      if (prono && prono.is_correct !== null && prono.is_correct !== undefined) {
        evaluated.push(d);
      }
      // Case 2: No pick but race results exist → Passés
      else if (!prono && evaluatedIds?.has(d.id)) {
        evaluated.push(d);
      }
      // Case 3: Everything else → En cours
      else {
        pending.push(d);
      }
    }

    // Sort evaluated by deadline descending (most recent first)
    evaluated.sort((a, b) => new Date(b.deadline_at).getTime() - new Date(a.deadline_at).getTime());

    return { openDeadlines: open, evaluatedDeadlines: evaluated, pendingDeadlines: pending };
  }, [deadlines, myPronostics, evaluatedIds]);

  const getPronosticForDeadline = (deadline: typeof deadlines extends (infer T)[] ? T : never) => {
    if (!myPronostics) return null;
    return myPronostics.find(
      (p) =>
        p.course_id === deadline.course_id &&
        p.pronostic_type === deadline.pronostic_type &&
        p.etape_numero === deadline.etape_numero
    ) || null;
  };

  const tabItems = [
    { label: t("pronostics.tabs.inProgress"), value: "inprogress" },
    { label: t("pronostics.tabs.upcoming"), value: "upcoming" },
    { label: t("pronostics.tabs.past"), value: "past" },
    { label: t("pronostics.tabs.standings"), value: "standings" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
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

  const renderDeadlineList = (list: typeof deadlines) => {
    if (!list || list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Target className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-sm">{t("pronostics.empty")}</p>
        </div>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((deadline) => (
          <PronosticRaceCard
            key={deadline.id}
            deadline={deadline}
            pronostic={getPronosticForDeadline(deadline)}
            leagueId={leagueId}
            managerId={managerId}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      <TabGroup
        items={tabItems}
        selected={activeTab}
        onSelect={setActiveTab}
      />

      {activeTab === "inprogress" && renderDeadlineList(pendingDeadlines)}
      {activeTab === "upcoming" && renderDeadlineList(openDeadlines)}
      {activeTab === "past" && renderDeadlineList(evaluatedDeadlines)}
      {activeTab === "standings" && <PronosticStandings leagueId={leagueId} />}
    </div>
  );
};

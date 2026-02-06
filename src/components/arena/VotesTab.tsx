import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Vote, Clock, Lock } from "lucide-react";
import { PollCard } from "./PollCard";
import { CreatePollDialog } from "./CreatePollDialog";
import { useArenaPolls, useCurrentManagerId } from "@/hooks/useArenaPolls";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { isPast } from "date-fns";

interface VotesTabProps {
  leagueId: string;
}

export const VotesTab = ({ leagueId }: VotesTabProps) => {
  const { t } = useTranslation("arena");
  const { data: managerId, isLoading: managerLoading } = useCurrentManagerId();
  const { data: polls, isLoading: pollsLoading } = useArenaPolls(leagueId, managerId || null);
  const { isSuperAdmin } = useUserRole();
  const { roles } = useUserLeagues();

  const isAdmin = isSuperAdmin || (roles[leagueId] && ["owner", "admin"].includes(roles[leagueId]));
  const isLoading = managerLoading || pollsLoading;

  const { openPolls, closedPolls } = useMemo(() => {
    if (!polls) return { openPolls: [], closedPolls: [] };
    const open = polls.filter((p) => !isPast(new Date(p.closes_at)));
    const closed = polls.filter((p) => isPast(new Date(p.closes_at)));
    return { openPolls: open, closedPolls: closed };
  }, [polls]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!managerId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("votes.noManager")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin: create poll */}
      {isAdmin && (
        <div className="flex justify-end">
          <CreatePollDialog leagueId={leagueId} managerId={managerId} />
        </div>
      )}

      {/* Open polls */}
      {openPolls.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {t("votes.sections.open")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {openPolls.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                managerId={managerId}
                leagueId={leagueId}
                isAdmin={!!isAdmin}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closed polls */}
      {closedPolls.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {t("votes.sections.closed")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {closedPolls.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                managerId={managerId}
                leagueId={leagueId}
                isAdmin={!!isAdmin}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {(!polls || polls.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Vote className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">{t("votes.empty")}</p>
          <p className="text-sm">{t("votes.emptyDesc")}</p>
        </div>
      )}
    </div>
  );
};

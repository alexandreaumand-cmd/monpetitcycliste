import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Vote } from "lucide-react";
import { PollCard } from "./PollCard";
import { CreatePollDialog } from "./CreatePollDialog";
import { useArenaPolls, useCurrentManagerId } from "@/hooks/useArenaPolls";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { isPast } from "date-fns";

interface ArenaPollsPanelProps {
  leagueId: string;
}

/**
 * Inline polls panel. Polls are a rarely used feature, so instead of owning a
 * full Arena tab they surface here: open polls are shown above the chat, past
 * polls stay reachable behind a toggle, and league admins keep the create action.
 */
export const ArenaPollsPanel = ({ leagueId }: ArenaPollsPanelProps) => {
  const { t } = useTranslation("arena");
  const { data: managerId } = useCurrentManagerId();
  const { data: polls } = useArenaPolls(leagueId, managerId || null);
  const { isSuperAdmin } = useUserRole();
  const { roles } = useUserLeagues();
  const [showPast, setShowPast] = useState(false);

  const isAdmin = isSuperAdmin || (roles[leagueId] && ["owner", "admin"].includes(roles[leagueId]));

  const { openPolls, closedPolls } = useMemo(() => {
    if (!polls) return { openPolls: [], closedPolls: [] };
    return {
      openPolls: polls.filter((p) => !isPast(new Date(p.closes_at))),
      closedPolls: polls.filter((p) => isPast(new Date(p.closes_at))),
    };
  }, [polls]);

  if (!managerId) return null;

  const hasSomething = openPolls.length > 0 || closedPolls.length > 0 || isAdmin;
  if (!hasSomething) return null;

  return (
    <div className="space-y-2">
      {openPolls.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
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
      )}

      <div className="flex flex-wrap items-center gap-2">
        {closedPolls.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => setShowPast((v) => !v)}
          >
            {showPast ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Vote className="h-3.5 w-3.5" />
            {t("votes.pastPolls", { count: closedPolls.length })}
          </Button>
        )}
        {isAdmin && <CreatePollDialog leagueId={leagueId} managerId={managerId} />}
      </div>

      {showPast && closedPolls.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
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
      )}
    </div>
  );
};

import { Badge } from "@/components/ui/badge";
import { Gavel } from "lucide-react";
import { useSuperAdminLeagueAuction } from "@/hooks/useSuperAdminLeagueAuction";

interface Props {
  leagueId: string;
  gameMode: string;
  compact?: boolean;
}

export function SuperAdminLeagueAuctionBadge({ leagueId, gameMode, compact }: Props) {
  const { data, isLoading } = useSuperAdminLeagueAuction(leagueId);

  if (isLoading) {
    return <span className="text-xs text-muted-foreground">…</span>;
  }

  if (!data) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const showPhase = gameMode === "five_phases" && data.phaseIndex != null;

  const variant =
    data.status === "open"
      ? "default"
      : data.status === "scheduled"
      ? "secondary"
      : "outline";

  const statusLabel =
    data.status === "open"
      ? "En cours"
      : data.status === "scheduled"
      ? "Planifiée"
      : "Terminée";

  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? "" : "min-w-[140px]"}`}>
      <Badge variant={variant} className="text-[10px] gap-1">
        <Gavel className="h-3 w-3" />
        {statusLabel}
      </Badge>
      <Badge variant="outline" className="text-[10px]">
        Round {data.roundNumber}
      </Badge>
      {showPhase && (
        <Badge variant="outline" className="text-[10px]">
          Phase {data.phaseIndex}
        </Badge>
      )}
    </div>
  );
}

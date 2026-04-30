import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gavel, Clock, CheckCircle2, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useSuperAdminLeagueAuction } from "@/hooks/useSuperAdminLeagueAuction";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  leagueId: string;
  gameMode: string;
}

const fmt = (d: string | null) =>
  d ? format(new Date(d), "dd MMM yyyy 'à' HH:mm", { locale: fr }) : "—";

export function SuperAdminLeagueAuctionStatus({ leagueId, gameMode }: Props) {
  const { data, isLoading } = useSuperAdminLeagueAuction(leagueId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-primary" />
          État des enchères
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            Aucune enchère active, planifiée ou récente pour cette ligue.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {data.status === "open" && (
                <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                  <Clock className="h-3 w-3" />
                  En cours
                </Badge>
              )}
              {data.status === "scheduled" && (
                <Badge variant="secondary" className="gap-1">
                  <CalendarClock className="h-3 w-3" />
                  Planifiée
                </Badge>
              )}
              {data.status === "closed" && (
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Terminée
                </Badge>
              )}
              <Badge variant="outline">Round {data.roundNumber}</Badge>
              {gameMode === "five_phases" && data.phaseIndex != null && (
                <Badge variant="outline">Phase {data.phaseIndex}</Badge>
              )}
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {data.status === "scheduled" && (
                <div>
                  <span className="text-muted-foreground">Ouverture : </span>
                  <span className="font-medium">{fmt(data.opensAt)}</span>
                </div>
              )}
              {data.status === "open" && (
                <div>
                  <span className="text-muted-foreground">Fin du round : </span>
                  <span className="font-medium">{fmt(data.deadlineAt)}</span>
                </div>
              )}
              {data.status === "closed" && (
                <div>
                  <span className="text-muted-foreground">Fermée le : </span>
                  <span className="font-medium">{fmt(data.closedAt)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

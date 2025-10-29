import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { useCountdown } from "@/hooks/useCountdown";

interface AuctionScheduledViewProps {
  opensAt: string;
  roundNumber: number;
  phaseId: string;
  leagueId: string | null;
}

export function AuctionScheduledView({ opensAt, roundNumber }: AuctionScheduledViewProps) {
  const countdown = useCountdown(opensAt);

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-6">
          {/* Icon */}
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-10 w-10 text-primary animate-pulse" />
            </div>
          </div>

          {/* Round Badge */}
          <Badge variant="secondary" className="text-sm px-4 py-1">
            Round {roundNumber}
          </Badge>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Les enchères vont démarrer</h2>
            <p className="text-muted-foreground">
              Prépare-toi, le prochain round commence bientôt !
            </p>
          </div>

          {/* Countdown */}
          {!countdown.isExpired && (
            <div className="grid grid-cols-4 gap-4 w-full max-w-md">
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-primary">{countdown.days}</div>
                <div className="text-xs text-muted-foreground uppercase">Jours</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-primary">{countdown.hours}</div>
                <div className="text-xs text-muted-foreground uppercase">Heures</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-primary">{countdown.minutes}</div>
                <div className="text-xs text-muted-foreground uppercase">Minutes</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-primary">{countdown.seconds}</div>
                <div className="text-xs text-muted-foreground uppercase">Secondes</div>
              </div>
            </div>
          )}

          {/* Opening date */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Ouverture le {new Date(opensAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeagueCard } from "@/components/dashboard/LeagueCard";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LeagueWithRole } from "@/lib/leagues/types";

type LeaguesSectionProps = {
  activeLeagues: LeagueWithRole[];
  archivedLeagues: LeagueWithRole[];
  onViewDetails: (leagueId: string) => void;
};

export function LeaguesSection({ activeLeagues, archivedLeagues, onViewDetails }: LeaguesSectionProps) {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-6">
      {/* Active Leagues */}
      <Card>
        <CardHeader>
          <CardTitle>Mes ligues actives</CardTitle>
        </CardHeader>
        <CardContent>
          {activeLeagues.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune ligue active
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeLeagues.map((league) => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  onViewDetails={() => onViewDetails(league.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archived Leagues */}
      {archivedLeagues.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowArchived(!showArchived)}>
            <div className="flex items-center justify-between">
              <CardTitle>Mes ligues archivées ({archivedLeagues.length})</CardTitle>
              <Button variant="ghost" size="sm">
                {showArchived ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {showArchived && (
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {archivedLeagues.map((league) => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    onViewDetails={() => onViewDetails(league.id)}
                  />
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

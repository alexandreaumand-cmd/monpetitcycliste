import { Users, Trophy, TrendingUp, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeagueMemberCount } from "@/hooks/useLeagueMemberCount";
import { useMyLeagueStats } from "@/hooks/useMyLeagueStats";
import type { LeagueWithRole } from "@/lib/leagues/types";

interface LeagueCardProps {
  league: LeagueWithRole;
  onViewDetails: () => void;
}

export function LeagueCard({ league, onViewDetails }: LeagueCardProps) {
  const { data: memberCount, isLoading: loadingMembers } = useLeagueMemberCount(league.id);
  const { data: stats, isLoading: loadingStats } = useMyLeagueStats(league.id);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return { label: 'Propriétaire', icon: '👑', variant: 'default' as const };
      case 'admin':
        return { label: 'Admin', icon: '⚙️', variant: 'secondary' as const };
      default:
        return { label: 'Membre', icon: '👤', variant: 'outline' as const };
    }
  };

  const roleBadge = getRoleBadge(league.role);

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{league.name}</CardTitle>
          <Badge variant={roleBadge.variant} className="shrink-0">
            {roleBadge.icon} {roleBadge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Member count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {loadingMembers ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <span>{memberCount} joueur{memberCount !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Stats */}
        {loadingStats ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : stats ? (
          <div className="space-y-3">
            {/* Season ranking */}
            {stats.mySeasonRank && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Classement général</p>
                    <p className="font-semibold">
                      {stats.mySeasonRank}
                      {stats.mySeasonRank === 1 && '🥇'}
                      {stats.mySeasonRank === 2 && '🥈'}
                      {stats.mySeasonRank === 3 && '🥉'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Points</p>
                  <p className="font-semibold">{stats.mySeasonPoints}</p>
                </div>
              </div>
            )}

            {/* Phase ranking */}
            {stats.myPhaseRank && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Classement phase</p>
                    <p className="font-semibold">{stats.myPhaseRank}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Points</p>
                  <p className="font-semibold">{stats.myPhasePoints}</p>
                </div>
              </div>
            )}

            {/* Leader */}
            {stats.seasonLeader && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Crown className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Leader</p>
                  <p className="font-semibold text-sm">{stats.seasonLeader.name}</p>
                </div>
                <p className="text-sm font-semibold">{stats.seasonLeader.points} pts</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée disponible</p>
        )}

        {/* Action button */}
        <Button onClick={onViewDetails} variant="outline" className="w-full">
          Voir le détail
        </Button>
      </CardContent>
    </Card>
  );
}

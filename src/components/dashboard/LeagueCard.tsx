import { useState } from "react";
import { Users, Trophy, TrendingUp, Crown, Calendar, Zap, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeagueMemberCount } from "@/hooks/useLeagueMemberCount";
import { useMyLeagueStats } from "@/hooks/useMyLeagueStats";
import { LeagueStatusBadge } from "@/components/leagues/LeagueStatusBadge";
import type { LeagueWithRole } from "@/lib/leagues/types";
import { LEAGUE_TEMPLATES } from "@/lib/leagues/templates";
import { LeagueInvitesBottomSheet } from "@/components/leagues/LeagueInvitesBottomSheet";

interface LeagueCardProps {
  league: LeagueWithRole;
  onViewDetails: () => void;
}

export function LeagueCard({ league, onViewDetails }: LeagueCardProps) {
  const [invitesSheetOpen, setInvitesSheetOpen] = useState(false);
  const { data: memberCount, isLoading: loadingMembers } = useLeagueMemberCount(league.id);
  const { data: stats, isLoading: loadingStats } = useMyLeagueStats(league.id);
  
  const isAdmin = league.role === 'owner' || league.role === 'admin';

  // Fetch season info
  const { data: seasonInfo } = useQuery({
    queryKey: ['league-season', league.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('league_scopes')
        .select(`
          season_id,
          saisons:season_id (
            annee
          )
        `)
        .eq('league_id', league.id)
        .single();
      
      if (error) throw error;
      return data?.saisons as { annee: number } | null;
    },
  });

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
  const gameMode = LEAGUE_TEMPLATES.find(t => t.id === league.game_mode);

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{league.name}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <LeagueStatusBadge status={league.status} />
              <Badge variant={roleBadge.variant}>
                {roleBadge.icon} {roleBadge.label}
              </Badge>
              {seasonInfo && (
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Saison {seasonInfo.annee}
                </Badge>
              )}
              {gameMode && (
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  {gameMode.name}
                </Badge>
              )}
              {league.bonuses_enabled && (
                <Badge variant="outline">Bonus ✓</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Member count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {loadingMembers ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <span>
              {league.current_player_count}/{league.max_players} joueurs
              {league.status === 'pending' && league.current_player_count < league.max_players && (
                <span className="text-xs ml-1">(en attente de {league.max_players - league.current_player_count})</span>
              )}
            </span>
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

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button onClick={onViewDetails} variant="outline" className="flex-1">
            Voir le détail
          </Button>
          {isAdmin && (
            <>
              <Button 
                onClick={() => setInvitesSheetOpen(true)}
                variant="secondary"
                size="icon"
                title="Gérer les invitations"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
              <LeagueInvitesBottomSheet
                open={invitesSheetOpen}
                onOpenChange={setInvitesSheetOpen}
                leagueId={league.id}
                leagueName={league.name}
                maxPlayers={league.max_players}
                currentPlayerCount={league.current_player_count}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

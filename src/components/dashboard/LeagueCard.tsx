import { useState } from "react";
import { Users, Trophy, TrendingUp, Crown, Calendar, Zap, UserPlus, CheckCircle, Lock, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeagueMemberCount } from "@/hooks/useLeagueMemberCount";
import { useMyLeagueStats } from "@/hooks/useMyLeagueStats";
import { useLeagueMembers } from "@/hooks/useLeagueMembers";
import { useLeagueSeason } from "@/hooks/useLeagueSeason";
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
  const { data: members = [], isLoading: loadingMembersList } = useLeagueMembers(league.id);
  
  const isAdmin = league.role === 'owner' || league.role === 'admin';
  const isPending = league.status === 'pending';
  const isWaitingForPlayers = isPending && league.current_player_count < league.max_players;
  const isReadyToLaunch = isPending && league.current_player_count === league.max_players;
  const isActive = league.status === 'active';
  const isCompleted = league.status === 'completed';
  const remainingSpots = league.max_players - league.current_player_count;

  // Fetch season from league_scopes (single source of truth)
  const { data: leagueSeason, isLoading: loadingSeason } = useLeagueSeason(league.id);

  // Pass season to stats hook
  const { data: stats, isLoading: loadingStats } = useMyLeagueStats(
    league.id,
    leagueSeason?.seasonId || null
  );

  const gameMode = LEAGUE_TEMPLATES.find(t => t.id === league.game_mode);

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader className="space-y-3">
        {/* Ligne 1 : Nom + Statut + Visibilité */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
          <CardTitle className="text-lg">{league.name}</CardTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            <LeagueStatusBadge 
              status={league.status} 
              currentPlayerCount={league.current_player_count}
              maxPlayers={league.max_players}
            />
            <Badge variant="outline" className="gap-1">
              {league.visibility === 'private' ? (
                <>
                  <Lock className="h-3 w-3" />
                  Privée
                </>
              ) : (
                <>
                  <Globe className="h-3 w-3" />
                  Publique
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Ligne 2 : Type de ligue + Saison */}
        <div className="flex items-center gap-2 flex-wrap">
          {gameMode && (
            <Badge 
              variant="outline" 
              className="gap-1 border-black text-black font-poppins"
            >
              <Zap className="h-3 w-3" />
              {gameMode.name}
            </Badge>
          )}
          {loadingSeason ? (
            <Badge 
              variant="outline" 
              className="gap-1 bg-muted/50"
            >
              <Calendar className="h-3 w-3 animate-pulse" />
              Chargement...
            </Badge>
          ) : leagueSeason?.season?.annee ? (
            <Badge 
              variant="outline" 
              className="gap-1 border-black text-black font-poppins"
            >
              <Calendar className="h-3 w-3" />
              {leagueSeason.season.annee}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* EN ATTENTE DE JOUEURS */}
        {isWaitingForPlayers && (
          <>
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Joueurs inscrits ({league.current_player_count}/{league.max_players})
              </h4>
              {loadingMembersList ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="bg-muted/50 rounded-lg p-3">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center">
                      En attente du premier joueur
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {members.map((member) => (
                        <li key={member.id} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-sm">{member.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Places restantes</span>
                <span className="text-3xl font-bold">{remainingSpots}</span>
              </div>
            </div>

            <Button 
              onClick={() => setInvitesSheetOpen(true)}
              className="w-full bg-[#FFD500] text-black border-2 border-black font-montserrat font-semibold hover:bg-yellow-400 gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Inviter des joueurs
            </Button>
          </>
        )}

        {/* PRÊT À LANCER */}
        {isReadyToLaunch && (
          <>
            <div className="bg-[#FFD500] border-2 border-black rounded-lg p-4 text-center shadow-md">
              <CheckCircle className="h-8 w-8 text-black mx-auto mb-2" />
              <p className="font-montserrat font-bold text-black">
                Tous les joueurs sont là !
              </p>
              <p className="text-sm font-poppins text-gray-900 mt-1">
                La ligue est prête à démarrer
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                {league.max_players} joueurs inscrits
              </h4>
              <div className="bg-muted/50 rounded-lg p-3">
                {loadingMembersList ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <ul className="grid grid-cols-2 gap-2">
                    {members.map((member) => (
                      <li key={member.id} className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-sm">{member.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <Button onClick={onViewDetails} className="w-full">
              Lancer la ligue
            </Button>
          </>
        )}

        {/* EN COURS */}
        {isActive && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{league.current_player_count} joueurs</span>
            </div>

            {loadingStats ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : stats ? (
              <div className="space-y-3">
                {stats.mySeasonRank && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Classement général</p>
                        <p className="font-semibold">
                          #{stats.mySeasonRank}
                          {stats.mySeasonRank === 1 && ' 🥇'}
                          {stats.mySeasonRank === 2 && ' 🥈'}
                          {stats.mySeasonRank === 3 && ' 🥉'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Points</p>
                      <p className="font-semibold">{stats.mySeasonPoints}</p>
                    </div>
                  </div>
                )}

                {stats.myPhaseRank && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Classement phase</p>
                        <p className="font-semibold">#{stats.myPhaseRank}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Points</p>
                      <p className="font-semibold">{stats.myPhasePoints}</p>
                    </div>
                  </div>
                )}

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

            <Button onClick={onViewDetails} variant="outline" className="w-full">
              Voir ma ligue
            </Button>
          </>
        )}

        {/* TERMINÉE */}
        {isCompleted && (
          <>
            <div className="bg-gradient-to-br from-black to-gray-900 rounded-lg p-4 border-2 border-[#FFD500] text-center shadow-lg">
              <Trophy className="h-8 w-8 text-[#FFD500] mx-auto mb-2" />
              <p className="font-montserrat font-bold text-white">
                Ligue terminée
              </p>
              {stats?.seasonLeader && (
                <p className="text-sm font-poppins text-gray-300 mt-1">
                  Vainqueur : {stats.seasonLeader.name}
                </p>
              )}
            </div>

            {stats?.mySeasonRank && (
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Votre classement final</p>
                <p className="text-2xl font-bold text-primary">#{stats.mySeasonRank}</p>
              </div>
            )}

            <Button onClick={onViewDetails} variant="outline" className="w-full">
              Voir les résultats
            </Button>
          </>
        )}

        <LeagueInvitesBottomSheet
          open={invitesSheetOpen}
          onOpenChange={setInvitesSheetOpen}
          leagueId={league.id}
          leagueName={league.name}
          maxPlayers={league.max_players}
          currentPlayerCount={league.current_player_count}
        />
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Trophy, TrendingUp, Crown, Calendar, Zap, UserPlus, CheckCircle, Lock, Globe, Gavel, CheckCircle2, Clock, PartyPopper, Megaphone, Star, StarOff, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountdown } from "@/hooks/useCountdown";
import { LeagueStatusBadge } from "@/components/leagues/LeagueStatusBadge";
import type { LeagueWithRole } from "@/lib/leagues/types";
import { getTemplates, type LeagueTemplate } from "@/lib/leagues/templates";
import { LeagueInvitesBottomSheet } from "@/components/leagues/LeagueInvitesBottomSheet";
import { LeagueParticipantsHover } from "./LeagueParticipantsHover";
import type { LeagueCardData } from "@/hooks/useLeagueCardsData";

interface LeagueCardProps {
  league: LeagueWithRole;
  cardData?: LeagueCardData;
  isLoadingCardData?: boolean;
  onViewDetails: (hasActiveAuction?: boolean) => void;
  onViewAnnouncements?: () => void;
}

export function LeagueCard({ league, cardData, isLoadingCardData, onViewDetails, onViewAnnouncements }: LeagueCardProps) {
  const { t } = useTranslation('dashboard');
  const [invitesSheetOpen, setInvitesSheetOpen] = useState(false);
  
  // Use pre-loaded data from cardData
  const members = cardData?.members || [];
  const owner = cardData?.owner || null;
  const leagueSeason = cardData?.season || null;
  const stats = cardData?.stats || null;
  const auctionStatus = cardData?.auctionStatus || null;
  const hasPublishedAuctions = cardData?.hasPublishedAuctions || false;
  
  const loadingMembers = isLoadingCardData;
  const loadingMembersList = isLoadingCardData;
  const loadingOwner = isLoadingCardData;
  const loadingSeason = isLoadingCardData;
  const loadingStats = isLoadingCardData;
  const loadingAuction = isLoadingCardData;
  
  const isAdmin = league.role === 'owner' || league.role === 'admin';
  const isPending = league.status === 'pending';
  const isWaitingForPlayers = isPending && league.current_player_count < league.max_players;
  const isReadyToLaunch = isPending && league.current_player_count === league.max_players;
  const isActive = league.status === 'active';
  const isCompleted = league.status === 'completed';
  const remainingSpots = league.max_players - league.current_player_count;

  // Countdown for auction deadline
  const countdown = useCountdown(auctionStatus?.deadlineAt || null);

  const { data: templates } = useQuery({
    queryKey: ['league-templates'],
    queryFn: () => getTemplates(),
    staleTime: 60000,
  });

  const gameMode = templates?.find(t => t.id === league.game_mode);

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader className="space-y-3">
        {/* Ligne 1 : Nom + Statut + Visibilité */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
          <CardTitle className="text-lg">{league.name}</CardTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            {league.status !== 'active' && (
              <LeagueStatusBadge 
                status={league.status} 
                currentPlayerCount={league.current_player_count}
                maxPlayers={league.max_players}
              />
            )}
            <Badge 
              variant="outline" 
              className="px-1.5" 
              title={league.visibility === 'private' ? t('leagueCard.private') : t('leagueCard.public')}
            >
              {league.visibility === 'private' ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Globe className="h-3 w-3" />
              )}
            </Badge>
          </div>
        </div>

        {/* Ligne 2 : Type de ligue + Saison + Joueurs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {gameMode && (
              <Badge 
                variant="outline" 
                className="gap-1 text-xs text-muted-foreground border-muted-foreground/30 font-inter shrink-0"
              >
                <Zap className="h-3 w-3" />
                {t(`leagueCard.gameMode.${gameMode.id}`)}
              </Badge>
            )}
            {loadingSeason ? (
              <Badge 
                variant="outline" 
                className="gap-1 bg-muted/50 shrink-0"
              >
                <Calendar className="h-3 w-3 animate-pulse" />
                {t('leagueCard.loading')}
              </Badge>
            ) : leagueSeason?.season?.annee ? (
              <Badge 
                variant="outline" 
                className="gap-1 text-xs text-muted-foreground border-muted-foreground/30 font-inter shrink-0"
              >
                <Calendar className="h-3 w-3" />
                {leagueSeason.season.annee}
              </Badge>
            ) : null}
            <Badge 
              variant="outline" 
              className={`gap-1 text-xs shrink-0 font-inter ${
                league.bonuses_enabled 
                  ? "text-amber-600 border-amber-300" 
                  : "text-muted-foreground border-muted-foreground/30"
              }`}
            >
              {league.bonuses_enabled ? <Star className="h-3 w-3" /> : <StarOff className="h-3 w-3" />}
              {league.bonuses_enabled ? "Bonus" : "Sans bonus"}
            </Badge>
          </div>
          <div className="ml-auto shrink-0">

            <LeagueParticipantsHover
              ownerName={owner?.nom || null}
              members={members}
              currentPlayerCount={league.current_player_count}
              isLoading={loadingMembersList || loadingOwner}
            />
          </div>
        </div>

        {/* Ligne 3 : Courses sélectionnées (mode per_course) */}
        {league.game_mode === 'per_course' && cardData?.selectedCourseNames && cardData.selectedCourseNames.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            {cardData.selectedCourseNames.map((name) => (
              <Badge 
                key={name}
                variant="outline" 
                className="text-[10px] px-1.5 py-0 text-muted-foreground border-muted-foreground/20 font-inter"
              >
                {name}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* EN ATTENTE DE JOUEURS */}
        {isWaitingForPlayers && (
          <>
            <div>
              {loadingMembersList ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="bg-muted/50 rounded-lg p-3">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center">
                      {t('leagueCard.waitingForFirstPlayer')}
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
                <span className="text-sm font-medium text-muted-foreground">{t('leagueCard.remainingSpots')}</span>
                <span className="text-3xl font-bold">{remainingSpots}</span>
              </div>
            </div>

            {isAdmin && (
              <Button 
                onClick={() => setInvitesSheetOpen(true)}
                className="w-full bg-bordure-gold text-foreground border-2 border-foreground font-montserrat font-semibold hover:bg-bordure-gold gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {t('leagueCard.invitePlayers')}
              </Button>
            )}
          </>
        )}

        {/* PRÊT À LANCER */}
        {isReadyToLaunch && (
          <>
            <div className="bg-bordure-gold border-2 border-black rounded-lg p-4 text-center shadow-md">
              <CheckCircle className="h-8 w-8 text-foreground mx-auto mb-2" />
              <p className="font-montserrat font-bold text-foreground">
                {t('leagueCard.allPlayersHere')}
              </p>
              <p className="text-sm font-inter text-gray-900 mt-1">
                {t('leagueCard.readyToStart')}
              </p>
            </div>

            <div>
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

            <Button onClick={() => onViewDetails()} className="w-full">
              {t('leagueCard.launchLeague')}
            </Button>
          </>
        )}

        {/* EN COURS */}
        {isActive && (
          <>

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
                        <p className="text-xs text-muted-foreground">{t('leagueCard.generalRanking')}</p>
                        <p className="font-semibold">
                          #{stats.mySeasonRank}
                          {stats.mySeasonRank === 1 && ' 🥇'}
                          {stats.mySeasonRank === 2 && ' 🥈'}
                          {stats.mySeasonRank === 3 && ' 🥉'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t('leagueCard.points')}</p>
                      <p className="font-semibold">{Math.round(stats.mySeasonPoints).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                )}

                {stats.myPhaseRank && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t('leagueCard.phaseRanking')}</p>
                        <p className="font-semibold">#{stats.myPhaseRank}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t('leagueCard.points')}</p>
                      <p className="font-semibold">{stats.myPhasePoints != null ? Math.round(stats.myPhasePoints).toLocaleString('fr-FR') : '-'}</p>
                    </div>
                  </div>
                )}

                {stats.seasonLeader && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Crown className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">{t('leagueCard.leader')}</p>
                      <p className="font-semibold text-sm">{stats.seasonLeader.name}</p>
                    </div>
                    <p className="text-sm font-semibold">{Math.round(stats.seasonLeader.points).toLocaleString('fr-FR')} pts</p>
                  </div>
                )}
              </div>
            ) : hasPublishedAuctions ? (
              <div className="text-center py-6 space-y-3">
                <Trophy className="h-8 w-8 text-muted-foreground/40 mx-auto animate-pulse" />
                <p className="text-sm font-semibold text-muted-foreground">{t('leagueCard.computingStats')}</p>
                <p className="text-xs text-muted-foreground">{t('leagueCard.computingStatsDesc')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.reload();
                  }}
                >
                  {t('leagueCard.refresh')}
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <Trophy className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-semibold text-muted-foreground">{t('leagueCard.noStatsYet')}</p>
                <p className="text-xs text-muted-foreground">{t('leagueCard.noStatsYetDesc')}</p>
              </div>
            )}

            {/* Section enchères (en cours, résultats OU programmées) */}
            {renderAuctionBlock()}

            <div className="flex gap-2 min-w-0">
              {auctionStatus && (
                <Button 
                  onClick={() => onViewDetails(true)} 
                  variant="outline" 
                  className="flex-1 min-w-0 truncate"
                >
                  {t('leagueCard.goToAuction')}
                </Button>
              )}
              {auctionStatus && onViewAnnouncements && (
                <Button
                  onClick={(e) => { e.stopPropagation(); onViewAnnouncements(); }}
                  variant="outline"
                  className={`relative gap-1.5 shrink-0 ${auctionStatus.isAnnouncementsPending ? 'border-[#E8A0B4] ring-2 ring-[#E8A0B4]/30' : ''}`}
                >
                  <Megaphone className="h-4 w-4" />
                  <span className={auctionStatus.isAnnouncementsPending ? "inline" : "hidden sm:inline"}>Annonces</span>
                  {auctionStatus.isAnnouncementsPending && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8A0B4] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#E8A0B4]"></span>
                    </span>
                  )}
                </Button>
              )}
            </div>
            <Button 
              onClick={() => onViewDetails(false)} 
              variant="outline" 
              className="w-full"
            >
              {t('leagueCard.viewMyLeague')}
            </Button>
          </>
        )}

        {/* TERMINÉE */}
        {isCompleted && (
          <>
            <div className="bg-gradient-to-br from-secondary to-gray-900 rounded-lg p-4 border-2 border-bordure-gold text-center shadow-lg">
              <Trophy className="h-8 w-8 text-bordure-gold mx-auto mb-2" />
              <p className="font-montserrat font-bold text-white">
                {t('leagueCard.leagueEnded')}
              </p>
              {stats?.seasonLeader && (
                <p className="text-sm font-inter text-foreground mt-1">
                  {t('leagueCard.winner')} : {stats.seasonLeader.name}
                </p>
              )}
            </div>

            {stats?.mySeasonRank && (
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('leagueCard.yourFinalRanking')}</p>
                <p className="text-2xl font-bold text-primary">#{stats.mySeasonRank}</p>
              </div>
            )}

            <Button onClick={() => onViewDetails()} variant="outline" className="w-full">
              {t('leagueCard.viewResults')}
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

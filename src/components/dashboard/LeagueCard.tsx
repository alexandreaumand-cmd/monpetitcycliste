import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Trophy, TrendingUp, Crown, Calendar, Zap, UserPlus, CheckCircle, Lock, Globe, Gavel, CheckCircle2, Clock, PartyPopper, Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountdown } from "@/hooks/useCountdown";
import { LeagueStatusBadge } from "@/components/leagues/LeagueStatusBadge";
import type { LeagueWithRole } from "@/lib/leagues/types";
import { getLeagueTemplates } from "@/lib/leagues/templates";
import { LeagueInvitesBottomSheet } from "@/components/leagues/LeagueInvitesBottomSheet";
import { LeagueParticipantsHover } from "./LeagueParticipantsHover";
import type { LeagueCardData } from "@/hooks/useLeagueCardsData";

interface LeagueCardProps {
  league: LeagueWithRole;
  cardData?: LeagueCardData;
  isLoadingCardData?: boolean;
  onViewDetails: (hasActiveAuction?: boolean) => void;
}

export function LeagueCard({ league, cardData, isLoadingCardData, onViewDetails }: LeagueCardProps) {
  const { t } = useTranslation('dashboard');
  const [invitesSheetOpen, setInvitesSheetOpen] = useState(false);
  
  // Use pre-loaded data from cardData
  const members = cardData?.members || [];
  const owner = cardData?.owner || null;
  const leagueSeason = cardData?.season || null;
  const stats = cardData?.stats || null;
  const auctionStatus = cardData?.auctionStatus || null;
  
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
    queryFn: getLeagueTemplates,
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
      </CardHeader>
      <CardContent className="space-y-4">
        {/* EN ATTENTE DE JOUEURS */}
        {isWaitingForPlayers && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('leagueCard.registeredPlayers')}
                </h4>
                <LeagueParticipantsHover
                  ownerName={owner?.nom || null}
                  members={members}
                  currentPlayerCount={league.current_player_count}
                  isLoading={loadingMembersList || loadingOwner}
                />
              </div>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('leagueCard.registeredPlayers')}
                </h4>
                <LeagueParticipantsHover
                  ownerName={owner?.nom || null}
                  members={members}
                  currentPlayerCount={league.current_player_count}
                  isLoading={loadingMembersList || loadingOwner}
                />
              </div>
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
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{t('leagueCard.noDataAvailable')}</p>
            )}

            {/* Section enchères (en cours, résultats OU programmées) */}
            {auctionStatus && !loadingAuction && (
              <div 
                onClick={() => onViewDetails(true)}
                className={
                  auctionStatus.isAnnouncementsPending 
                    ? "bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-400 rounded-lg p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow"
                    : auctionStatus.isScheduled 
                      ? "bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-400 rounded-lg p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow"
                      : "bg-gradient-to-br from-[#FFF4CC] to-[#FFE999] border-2 border-bordure-gold rounded-lg p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow"
                }
              >
                <div className="flex items-center gap-2">
                  {auctionStatus.isAnnouncementsPending ? (
                    <>
                      <PartyPopper className="h-5 w-5 text-orange-600" />
                      <h3 className="font-montserrat font-bold text-orange-900">
                        {t('leagueCard.auction.resultsInProgress')}
                      </h3>
                    </>
                  ) : auctionStatus.isScheduled ? (
                    <>
                      <Clock className="h-5 w-5 text-blue-600" />
                      <h3 className="font-montserrat font-bold text-blue-900">
                        {t('leagueCard.auction.scheduled')}
                      </h3>
                    </>
                  ) : (
                    <>
                      <Gavel className="h-5 w-5 text-amber-900" />
                      <h3 className="font-montserrat font-bold text-amber-900">
                        {t('leagueCard.auction.inProgress')}
                      </h3>
                    </>
                  )}
                </div>
                
                <div className="space-y-2">
                  {/* Round number */}
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-inter ${
                      auctionStatus.isAnnouncementsPending ? 'text-orange-800' 
                        : auctionStatus.isScheduled ? 'text-blue-800' 
                        : 'text-amber-900'
                    }`}>
                      {t('leagueCard.auction.round')}
                    </span>
                    <span className={`text-lg font-montserrat font-bold ${
                      auctionStatus.isAnnouncementsPending ? 'text-orange-900' 
                        : auctionStatus.isScheduled ? 'text-blue-900' 
                        : 'text-amber-900'
                    }`}>
                      Round {auctionStatus.roundNumber}
                    </span>
                  </div>
                  
                  {/* Message résultats en cours */}
                  {auctionStatus.isAnnouncementsPending && (
                    <div className="bg-orange-50/80 rounded-lg p-3 border border-orange-200 mt-3">
                      <p className="text-sm text-orange-800 text-center">
                        {t('leagueCard.auction.resultsRevealing')}
                      </p>
                      <p className="text-xs text-orange-600 text-center mt-1">
                        {t('leagueCard.auction.clickToSeeAnnouncements')}
                      </p>
                    </div>
                  )}
                  
                  {/* Validation status - seulement pour enchères ouvertes */}
                  {!auctionStatus.isScheduled && !auctionStatus.isAnnouncementsPending && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-inter text-amber-900 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          {t('leagueCard.auction.validatedManagers')}
                        </span>
                        <span className="text-lg font-montserrat font-bold text-amber-900">
                          {auctionStatus.validatedCount}/{auctionStatus.totalManagers}
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-white/50 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-secondary h-full transition-all duration-500 ease-out"
                          style={{ 
                            width: `${(auctionStatus.validatedCount / auctionStatus.totalManagers) * 100}%` 
                          }}
                        />
                      </div>
                    </>
                  )}

                  {/* Countdown - seulement pour open et scheduled */}
                  {!auctionStatus.isAnnouncementsPending && (
                    <div className={`${auctionStatus.isScheduled ? 'bg-blue-50/80 dark:bg-blue-950/40' : 'bg-white/80 dark:bg-background/80'} rounded-lg p-3 border ${auctionStatus.isScheduled ? 'border-blue-200 dark:border-blue-800' : 'border-border'} mt-3`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className={`h-4 w-4 ${auctionStatus.isScheduled ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`} />
                        <span className={`text-xs font-inter font-medium ${auctionStatus.isScheduled ? 'text-blue-800 dark:text-blue-300' : 'text-foreground'}`}>
                          {auctionStatus.isScheduled ? t('leagueCard.auction.openingIn') : t('leagueCard.auction.timeRemaining')}
                        </span>
                      </div>
                      
                      {countdown.isExpired ? (
                        <p className="text-sm font-montserrat font-bold text-primary">
                          {auctionStatus.isScheduled ? t('leagueCard.auction.openingInProgress') : t('leagueCard.auction.closingInProgress')}
                        </p>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <div className="text-center">
                            <div className={`text-2xl font-montserrat font-bold ${auctionStatus.isScheduled ? 'text-blue-900 dark:text-blue-200' : 'text-foreground'}`}>
                              {String(countdown.days).padStart(2, '0')}
                            </div>
                            <div className={`text-xs ${auctionStatus.isScheduled ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                              {countdown.days > 1 ? t('leagueCard.auction.days') : t('leagueCard.auction.day')}
                            </div>
                          </div>
                          <div className={`text-xl font-bold ${auctionStatus.isScheduled ? 'text-blue-900 dark:text-blue-200' : 'text-foreground'}`}>:</div>
                          <div className="text-center">
                            <div className={`text-2xl font-montserrat font-bold ${auctionStatus.isScheduled ? 'text-blue-900 dark:text-blue-200' : 'text-foreground'}`}>
                              {String(countdown.hours).padStart(2, '0')}
                            </div>
                            <div className={`text-xs ${auctionStatus.isScheduled ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>h</div>
                          </div>
                          <div className={`text-xl font-bold ${auctionStatus.isScheduled ? 'text-blue-900 dark:text-blue-200' : 'text-foreground'}`}>:</div>
                          <div className="text-center">
                            <div className={`text-2xl font-montserrat font-bold ${auctionStatus.isScheduled ? 'text-blue-900 dark:text-blue-200' : 'text-foreground'}`}>
                              {String(countdown.minutes).padStart(2, '0')}
                            </div>
                            <div className={`text-xs ${auctionStatus.isScheduled ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>min</div>
                          </div>
                          <div className={`text-xl font-bold ${auctionStatus.isScheduled ? 'text-blue-900 dark:text-blue-200' : 'text-foreground'}`}>:</div>
                          <div className="text-center">
                            <div className={`text-2xl font-montserrat font-bold ${auctionStatus.isScheduled ? 'text-blue-900 dark:text-blue-200' : 'text-foreground'}`}>
                              {String(countdown.seconds).padStart(2, '0')}
                            </div>
                            <div className={`text-xs ${auctionStatus.isScheduled ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>sec</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button 
              onClick={() => onViewDetails(!!auctionStatus)} 
              variant="outline" 
              className="w-full"
            >
              {auctionStatus ? t('leagueCard.goToAuction') : t('leagueCard.viewMyLeague')}
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

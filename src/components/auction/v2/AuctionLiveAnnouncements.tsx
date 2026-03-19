import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trophy, Users, TrendingUp, PartyPopper, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ManagerRecruit {
  coureur_id: string;
  nom: string;
  equipe: string;
  prix_signature: number;
}

interface ManagerRecruits {
  manager_id: string;
  manager_nom: string;
  recruits: ManagerRecruit[];
}

interface AuctionLiveAnnouncementsProps {
  auctionId: string;
  managerId: string;
  phaseId: string;
  onBack?: () => void;
}

export function AuctionLiveAnnouncements({
  auctionId,
  managerId,
  phaseId,
  onBack,
}: AuctionLiveAnnouncementsProps) {
  const { t } = useTranslation('auction');
  const [selectedAuctionId, setSelectedAuctionId] = useState(auctionId);
  const [liveAnnonces, setLiveAnnonces] = useState<any[]>([]);
  const [replayVisibleCount, setReplayVisibleCount] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [myRecruitsOpen, setMyRecruitsOpen] = useState(true);
  const [openManagers, setOpenManagers] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const replayStartedForRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();

  // Fetch available rounds for round selector
  const { data: availableRounds = [] } = useQuery({
    queryKey: ['auction-rounds-selector', phaseId, leagueId],
    queryFn: async () => {
      let query = supabase
        .from("auctions")
        .select("id, round_number, statut")
        .eq("phase_id", phaseId);

      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }

      // Include closed rounds + the current round
      query = query.in("statut", ["closed", "open", "scheduled"]);

      const { data, error } = await query.order("round_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch live status using selectedAuctionId
  const { data: liveStatus, refetch } = useQuery({
    queryKey: ['auction-live-status', selectedAuctionId, managerId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('auction-get-live-status', {
        body: { auction_id: selectedAuctionId, phase_id: phaseId, league_id: leagueId },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000,
  });

  // Cleanup replay timer on unmount
  useEffect(() => {
    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, []);

  // Start replay when data arrives for a closed round
  useEffect(() => {
    if (liveStatus?.annonces) {
      const allAnnonces = liveStatus.annonces;
      setLiveAnnonces(allAnnonces);

      const isClosedRound = liveStatus?.unpublished_count === 0 && allAnnonces.length > 0;

      if (isClosedRound) {
        // Only start replay once per auction
        if (replayStartedForRef.current === selectedAuctionId) return;
        replayStartedForRef.current = selectedAuctionId;

        if (replayTimerRef.current) clearInterval(replayTimerRef.current);
        setReplayVisibleCount(1);
        setIsReplaying(true);

        let count = 1;
        replayTimerRef.current = setInterval(() => {
          count++;
          setReplayVisibleCount(count);
          if (count >= allAnnonces.length) {
            if (replayTimerRef.current) clearInterval(replayTimerRef.current);
            replayTimerRef.current = null;
            setIsReplaying(false);
          }
        }, 5000);
      } else {
        // Live mode: show all as they come
        setReplayVisibleCount(allAnnonces.length);
        setIsReplaying(false);
      }
    }
  }, [liveStatus, selectedAuctionId]);

  // Handle new announcements - scroll to top for reversed order
  useEffect(() => {
    const currentVisible = Math.min(replayVisibleCount, liveAnnonces.length);
    if (currentVisible > prevCountRef.current) {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
    prevCountRef.current = currentVisible;
  }, [replayVisibleCount, liveAnnonces]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('live-annonces')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'annonces',
          filter: `auction_id=eq.${selectedAuctionId}`,
        },
        (payload) => {
          console.log('New annonce published!', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedAuctionId, refetch]);

  const toggleManager = (managerId: string) => {
    setOpenManagers(prev => {
      const next = new Set(prev);
      if (next.has(managerId)) {
        next.delete(managerId);
      } else {
        next.add(managerId);
      }
      return next;
    });
  };

  // Compute visible announcements for replay
  const visibleAnnonces = liveAnnonces.slice(0, replayVisibleCount);

  const totalAnnonces = liveStatus?.total_annonces || 0;
  const publishedCount = liveStatus?.published_count || 0;
  const unpublishedCount = liveStatus?.unpublished_count || 0;
  const isComplete = unpublishedCount === 0 && !isReplaying;
  const myWinsCount = visibleAnnonces.filter(a => a.is_my_win).length;
  const myNewRiders = isReplaying ? [] : (liveStatus?.my_new_riders || []);
  const allManagersRecruits: ManagerRecruits[] = isReplaying ? [] : (liveStatus?.all_managers_recruits || []);
  const recentlyAnnouncedManagerId = liveStatus?.recently_announced_manager_id;

  return (
    <div className="animate-fade-in px-2 sm:px-0">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left column: Announcements feed */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-6">
          {/* Header */}
          <Card>
            <CardHeader className="py-3 sm:py-6 px-3 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-xl">
                  <PartyPopper className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <span className="truncate">{t('live.resultsRound', { round: liveStatus?.auction?.round_number || '' })}</span>
                </CardTitle>
                <Badge variant={isComplete ? "default" : "secondary"} className={`text-xs sm:text-sm shrink-0 ${isReplaying ? 'animate-pulse' : ''}`}>
                  {isReplaying ? `${replayVisibleCount}/${liveAnnonces.length}` : `${publishedCount}/${totalAnnonces}`}
                </Badge>
              </div>

              {/* Round selector */}
              {availableRounds.length > 1 && (
                <ScrollArea className="w-full mt-3">
                  <div className="flex gap-1.5 pb-1">
                    {availableRounds.map((round) => (
                      <Button
                        key={round.id}
                        variant={selectedAuctionId === round.id ? "default" : "outline"}
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => {
                          if (replayTimerRef.current) clearInterval(replayTimerRef.current);
                          replayTimerRef.current = null;
                          setSelectedAuctionId(round.id);
                          setLiveAnnonces([]);
                          setReplayVisibleCount(0);
                          setIsReplaying(false);
                          prevCountRef.current = 0;
                        }}
                      >
                        Round {round.round_number}
                      </Button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </CardHeader>
            <CardContent className="py-2 sm:py-4 px-3 sm:px-6">
              {isReplaying ? (
                <p className="text-xs sm:text-sm text-muted-foreground animate-pulse">
                  🎬 Replay en cours... prochaine annonce dans 5s
                </p>
              ) : isComplete ? (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ✅ {t('live.allResultsAnnounced')}
                </p>
              ) : publishedCount > 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  🎬 {t('live.adminRevealing')}
                </p>
              ) : unpublishedCount > 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground animate-pulse">
                  ⏳ {t('live.preparingAnnouncements', 'Préparation des annonces en cours...')}
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  🎬 {t('live.adminRevealing')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* My stats */}
          {myWinsCount > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="py-3 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
                  <div>
                    <p className="font-semibold text-sm sm:text-lg">
                      🎉 {t(myWinsCount > 1 ? 'live.congratsWon_plural' : 'live.congratsWon', { count: myWinsCount })}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {t('live.teamGrowing')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Announcements feed - REVERSED ORDER */}
          <Card>
            <CardHeader className="py-3 sm:py-6 px-3 sm:px-6">
              <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-xl">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('live.liveAnnouncements')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <ScrollArea className="h-[50vh] sm:h-[600px] pr-2 sm:pr-4" ref={scrollRef}>
                <div className="space-y-4">
                  {visibleAnnonces.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                      {t('live.waitingAnnouncements')}
                    </p>
                  ) : (
                    (() => {
      // Afficher le message quand il reste exactement 10 annonces à publier
      const remainingCount = totalAnnonces - visibleAnnonces.length;
      const shouldShowTop10Message = totalAnnonces > 10 && remainingCount === 10;

      return visibleAnnonces.map((annonce, idx) => {
        // Le message apparaît en haut de la liste (avant la dernière annonce publiée)
        const showTop10Before = shouldShowTop10Message && idx === 0;

                        return (
                          <div key={`wrapper-${annonce.id}`}>
                            {/* Message Top 10 */}
                            {showTop10Before && (
                              <div className="p-3 sm:p-6 rounded-lg bg-gradient-to-r from-bordure-gold/20 to-orange-500/20 border-2 border-bordure-gold text-center animate-fade-in mb-3 sm:mb-4">
                                <p className="font-bold text-base sm:text-xl">🏆 {t('live.top10Message')} 🏆</p>
                              </div>
                            )}

                            {/* Annonce normale */}
                            <div
                              className={`p-2.5 sm:p-4 rounded-lg border animate-fade-in ${
                                annonce.is_my_win
                                  ? 'bg-primary/10 border-primary'
                                  : 'bg-card'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 sm:gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
                                    {annonce.type === 'gain' ? (
                                      <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                                    ) : (
                                      <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-bordure-gold shrink-0" />
                                    )}
                                    <span className="font-semibold text-sm sm:text-base truncate">
                                      {annonce.coureur?.nom}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                                      {annonce.type === 'egalite' 
                                        ? `${annonce.losers?.length || 0} ench.`
                                        : `${(annonce.losers?.length || 0) + 1} ench.`
                                      }
                                    </Badge>
                                    {idx === 0 && (
                                      <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">
                                        {t('live.new')}
                                      </Badge>
                                    )}
                                  </div>

                                  {annonce.type === 'gain' ? (
                                    <div>
                                      <p className="text-xs sm:text-sm">
                                        {annonce.is_my_win ? (
                                          <span className="font-semibold text-primary">
                                            🎉 {t('live.wonFor', { amount: annonce.winning_amount })}
                                          </span>
                                        ) : (
                                          <span>
                                            <strong>{annonce.winning_manager?.nom}</strong> — {annonce.winning_amount}
                                          </span>
                                        )}
                                      </p>
                                      {annonce.losers && annonce.losers.length > 0 && (
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">
                                          {annonce.is_my_win ? (
                                            <>✅ {annonce.losers.map((l: any) => `${l.manager} (${l.montant})`).join(', ')}</>
                                          ) : (
                                            <>{annonce.losers.map((l: any) => `${l.manager} (${l.montant})`).join(', ')}</>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <p className="text-xs sm:text-sm">
                                        🟨 {t('live.tieAt', { amount: annonce.winning_amount })}
                                      </p>
                                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                                        {annonce.losers?.map((l: any) => l.manager).join(', ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Completion message */}
          {isComplete && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardContent className="py-4 sm:pt-6 text-center space-y-3 sm:space-y-4 px-3 sm:px-6">
                <div>
                  <p className="text-base sm:text-lg font-semibold text-green-600 dark:text-green-400">
                    ✅ {t('live.resultsComplete')}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                    {t('live.canViewTeam')}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['auction-context'] });
                    queryClient.invalidateQueries({ queryKey: ['my-active-phases'] });
                    onBack?.();
                  }}
                  className="mx-auto"
                  size="sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  {t('live.backToAuction')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: My new riders + Other managers */}
        <div className="lg:col-span-1 space-y-3 sm:space-y-4">
          {/* Mes nouvelles recrues - Collapsible */}
          {myNewRiders.length > 0 && (
            <Card className="lg:sticky lg:top-6">
              <Collapsible open={myRecruitsOpen} onOpenChange={setMyRecruitsOpen}>
                <CardHeader className="py-2.5 sm:pb-2 px-3 sm:px-6">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors">
                      <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-xl">
                        <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                        {t('live.myRecruits')}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Badge variant="default" className="text-sm sm:text-lg px-2 sm:px-3">
                          {myNewRiders.length}
                        </Badge>
                        {myRecruitsOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-1 sm:pt-2 px-2 sm:px-6">
                    <div className="space-y-1.5 sm:space-y-2">
                      {myNewRiders.map((rider: ManagerRecruit) => (
                        <div
                          key={rider.coureur_id}
                          className="flex items-center justify-between p-2 sm:p-3 rounded-lg border bg-card animate-slide-in-right"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm sm:text-base truncate">{rider.nom}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{rider.equipe}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs sm:text-sm ml-2 shrink-0">{rider.prix_signature}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Autres managers */}
          {allManagersRecruits.length > 0 && (
            <Card>
              <CardHeader className="py-2.5 sm:pb-2 px-3 sm:px-6">
                <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                  <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {t('live.otherManagersRecruits')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <ScrollArea className="h-[40vh] sm:h-[calc(100vh-400px)] sm:min-h-[300px]">
                  <div className="space-y-1.5 sm:space-y-2 pr-2 sm:pr-4">
                    {allManagersRecruits.map((mgrData) => {
                      const isRecentlyAnnounced = recentlyAnnouncedManagerId === mgrData.manager_id;
                      const isOpen = openManagers.has(mgrData.manager_id);
                      
                      return (
                        <Collapsible 
                          key={mgrData.manager_id}
                          open={isOpen}
                          onOpenChange={() => toggleManager(mgrData.manager_id)}
                        >
                          <div 
                            className={`rounded-lg border transition-all duration-500 ${
                              isRecentlyAnnounced 
                                ? 'border-bordure-gold bg-bordure-gold/10 ring-2 ring-bordure-gold/50 animate-pulse' 
                                : 'bg-card'
                            }`}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-2 sm:p-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg">
                                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                                  {isRecentlyAnnounced && (
                                    <span className="text-bordure-gold animate-bounce shrink-0">🎯</span>
                                  )}
                                  <span className={`font-medium text-sm sm:text-base truncate ${isRecentlyAnnounced ? 'text-bordure-gold dark:text-bordure-gold' : ''}`}>
                                    {mgrData.manager_nom}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                  <Badge 
                                    variant={mgrData.recruits.length > 0 ? "default" : "outline"}
                                    className={`min-w-[2rem] sm:min-w-[2.5rem] justify-center text-xs sm:text-sm ${
                                      isRecentlyAnnounced ? 'bg-bordure-gold text-yellow-950' : ''
                                    }`}
                                  >
                                    {mgrData.recruits.length}
                                  </Badge>
                                  {mgrData.recruits.length > 0 && (
                                    isOpen ? (
                                      <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                                    )
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            
                            {mgrData.recruits.length > 0 && (
                              <CollapsibleContent>
                                <div className="px-2 sm:px-3 pb-2 sm:pb-3 space-y-1">
                                  {mgrData.recruits.map((rider) => (
                                    <div
                                      key={rider.coureur_id}
                                      className="flex items-center justify-between p-1.5 sm:p-2 rounded bg-muted/50 text-xs sm:text-sm"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium truncate">{rider.nom}</p>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{rider.equipe}</p>
                                      </div>
                                      <Badge variant="outline" className="text-[10px] sm:text-xs ml-1.5 shrink-0">
                                        {rider.prix_signature}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            )}
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

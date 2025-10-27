import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Trophy, Users, TrendingUp, PartyPopper, ArrowLeft } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";

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
  const [liveAnnonces, setLiveAnnonces] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();

  // Fetch live status
  const { data: liveStatus, refetch } = useQuery({
    queryKey: ['auction-live-status', auctionId, managerId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('auction-get-live-status', {
        body: { auction_id: auctionId, phase_id: phaseId, league_id: leagueId },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000,
  });

  // Update local state when new data arrives
  useEffect(() => {
    if (liveStatus?.annonces) {
      setLiveAnnonces(liveStatus.annonces);
    }
  }, [liveStatus]);

  // Handle new announcements - scroll to top for reversed order
  useEffect(() => {
    if (liveAnnonces.length > prevCountRef.current) {
      // Scroll to top to show latest announcement
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
    prevCountRef.current = liveAnnonces.length;
  }, [liveAnnonces]);

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
          filter: `auction_id=eq.${auctionId}`,
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
  }, [auctionId, refetch]);

  const totalAnnonces = liveStatus?.total_annonces || 0;
  const publishedCount = liveStatus?.published_count || 0;
  const unpublishedCount = liveStatus?.unpublished_count || 0;
  const isComplete = unpublishedCount === 0;
  const myWinsCount = liveAnnonces.filter(a => a.is_my_win).length;

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Announcements feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <PartyPopper className="h-5 w-5 text-primary" />
                  Résultats Round {liveStatus?.auction?.round_number || ''}
                </CardTitle>
                <Badge variant={isComplete ? "default" : "secondary"}>
                  {publishedCount}/{totalAnnonces} annonces
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isComplete ? (
                <p className="text-sm text-muted-foreground">
                  ✅ Tous les résultats ont été annoncés !
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  🎬 L'admin est en train de révéler les résultats...
                </p>
              )}
            </CardContent>
          </Card>

          {/* My stats */}
          {myWinsCount > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Trophy className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold text-lg">
                      🎉 Bravo ! Tu as gagné {myWinsCount} coureur{myWinsCount > 1 ? 's' : ''} !
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ton équipe se renforce...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Announcements feed - REVERSED ORDER */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Annonces en direct
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4" ref={scrollRef}>
                <div className="space-y-4">
                  {liveAnnonces.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      En attente des annonces...
                    </p>
                  ) : (
                    (() => {
                      const reversedAnnonces = [...liveAnnonces].reverse();
                      const shouldShowTop10Message = totalAnnonces > 10;
                      const top10Position = totalAnnonces - 10;

                      return reversedAnnonces.map((annonce, idx) => {
                        const showTop10Before = shouldShowTop10Message && idx === top10Position;

                        return (
                          <div key={`wrapper-${annonce.id}`}>
                            {/* Message Top 10 */}
                            {showTop10Before && (
                              <div className="p-6 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 text-center animate-fade-in mb-4">
                                <p className="font-bold text-xl">🏆 On arrive au top 10 ! 🏆</p>
                              </div>
                            )}

                            {/* Annonce normale */}
                            <div
                              className={`p-4 rounded-lg border animate-fade-in ${
                                annonce.is_my_win
                                  ? 'bg-primary/10 border-primary'
                                  : 'bg-card'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    {annonce.type === 'gain' ? (
                                      <Trophy className="h-4 w-4 text-primary" />
                                    ) : (
                                      <Users className="h-4 w-4 text-yellow-500" />
                                    )}
                                    <span className="font-semibold">
                                      {annonce.coureur?.nom}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {annonce.coureur?.equipe}
                                    </Badge>
                                    {idx === 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        Nouveau !
                                      </Badge>
                                    )}
                                  </div>

                                  {annonce.type === 'gain' ? (
                                    <div>
                                      <p className="text-sm">
                                        {annonce.is_my_win ? (
                                          <span className="font-semibold text-primary">
                                            🎉 Gagné par toi pour {annonce.winning_amount}€
                                            {(!annonce.losers || annonce.losers.length === 0) && (
                                              <Badge variant="outline" className="ml-2 text-xs">
                                                Seul enchérisseur
                                              </Badge>
                                            )}
                                          </span>
                                        ) : (
                                          <span>
                                            Gagné par <strong>{annonce.winning_manager?.nom}</strong> pour {annonce.winning_amount}€
                                          </span>
                                        )}
                                      </p>
                                      {annonce.losers && annonce.losers.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {annonce.is_my_win ? (
                                            <>✅ Tu bats : {annonce.losers.map((l: any) => `${l.manager} (${l.montant}€)`).join(', ')}</>
                                          ) : (
                                            <>Autres enchères : {annonce.losers.map((l: any) => `${l.manager} (${l.montant}€)`).join(', ')}</>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <p className="text-sm">
                                        🟨 Égalité à {annonce.winning_amount}€
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {annonce.losers?.map((l: any) => l.manager).join(', ')} - On retente au prochain round !
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
              <CardContent className="pt-6 text-center space-y-4">
                <div>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    ✅ Résultats complets !
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Tu peux maintenant consulter ton équipe complète
                  </p>
                </div>
                <Button
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['auction-context'] });
                    queryClient.invalidateQueries({ queryKey: ['my-active-phases'] });
                    onBack?.();
                  }}
                  className="mx-auto"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour aux enchères
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: My new riders */}
        <div className="lg:col-span-1">
          {liveStatus?.my_new_riders && liveStatus.my_new_riders.length > 0 && (
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Mes nouvelles recrues ({liveStatus.my_new_riders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="space-y-2 pr-4">
                    {liveStatus.my_new_riders.map((rider: any) => (
                      <div
                        key={rider.coureur_id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card animate-slide-in-right"
                      >
                        <div>
                          <p className="font-semibold">{rider.nom}</p>
                          <p className="text-sm text-muted-foreground">{rider.equipe}</p>
                        </div>
                        <Badge variant="secondary">{rider.prix_signature}€</Badge>
                      </div>
                    ))}
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

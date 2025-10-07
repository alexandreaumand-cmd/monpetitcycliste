import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Trophy, Users, TrendingUp, PartyPopper } from "lucide-react";

interface AuctionLiveAnnouncementsProps {
  auctionId: string;
  managerId: string;
  phaseId: string;
}

export function AuctionLiveAnnouncements({
  auctionId,
  managerId,
  phaseId,
}: AuctionLiveAnnouncementsProps) {
  const [liveAnnonces, setLiveAnnonces] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Fetch live status
  const { data: liveStatus, refetch } = useQuery({
    queryKey: ['auction-live-status', auctionId, managerId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('auction-get-live-status', {
        body: { auction_id: auctionId, phase_id: phaseId },
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

  // Handle new announcements
  useEffect(() => {
    if (liveAnnonces.length > prevCountRef.current) {
      // Scroll to latest
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
    <div className="space-y-6 animate-fade-in">
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

      {/* Announcements feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Annonces en direct
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
            <div className="space-y-4">
              {liveAnnonces.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  En attente des annonces...
                </p>
              ) : (
                liveAnnonces.map((annonce, idx) => (
                  <div
                    key={annonce.id}
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
                          {idx === liveAnnonces.length - 1 && (
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
                                </span>
                              ) : (
                                <span>
                                  Gagné par <strong>{annonce.winning_manager?.nom}</strong> pour {annonce.winning_amount}€
                                </span>
                              )}
                            </p>
                            {annonce.losers && annonce.losers.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Autres enchères : {annonce.losers.map((l: any) => `${l.manager} (${l.montant}€)`).join(', ')}
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
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* My new riders */}
      {liveStatus?.my_new_riders && liveStatus.my_new_riders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mes nouvelles recrues ({liveStatus.my_new_riders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
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
          </CardContent>
        </Card>
      )}

      {/* Completion message */}
      {isComplete && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              ✅ Résultats complets !
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Tu peux maintenant consulter ton équipe complète
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

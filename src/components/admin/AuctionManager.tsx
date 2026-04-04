import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLeague } from "@/contexts/LeagueContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useAuctionStatus } from "@/hooks/useAuctionStatus";
import { AuctionCreator } from "@/components/admin/auction/AuctionCreator";
import { AuctionSupervision } from "@/components/admin/auction/AuctionSupervision";

export const AuctionManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();
  const [resetPhrase, setResetPhrase] = useState("");

  const {
    phases,
    loadingPhases,
    activeAuctions,
    closedAuctions,
    activePhase,
    nextRoundNumber,
  } = useAuctionStatus();

  const closeAuction = useMutation({
    mutationFn: async (auctionId: string) => {
      const { data, error: functionError } = await supabase.functions.invoke('clore-round', {
        body: { auction_id: auctionId, league_id: leagueId }
      });
      if (functionError) throw functionError;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-auctions'] });
      queryClient.invalidateQueries({ queryKey: ['closed-auctions'] });
      toast({ title: "Enchère clôturée ✅", description: `${data?.annonces_count || 0} annonces créées` });
    },
    onError: (error) => {
      toast({ title: "Erreur lors de la clôture", description: error.message, variant: "destructive" });
    }
  });

  const reprocessRound = useMutation({
    mutationFn: async (auctionId: string) => {
      const { data, error } = await supabase.functions.invoke('clore-round', {
        body: { auction_id: auctionId, league_id: leagueId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['closed-auctions'] });
      toast({ title: "Round retraité ✅", description: `${data?.annonces_count || 0} annonces créées` });
    },
    onError: (error) => {
      toast({ title: "Erreur lors du retraitement", description: error.message, variant: "destructive" });
    }
  });

  const resetPhase = useMutation({
    mutationFn: async () => {
      if (!activePhase) throw new Error("Aucune phase active");
      const { data, error } = await supabase.functions.invoke('admin-reset-phase', {
        body: { phase_id: activePhase.id, confirmation_phrase: resetPhrase }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-auctions'] });
      queryClient.invalidateQueries({ queryKey: ['managers-rosters-status'] });
      toast({
        title: "Phase réinitialisée ✅",
        description: `Supprimés : ${data.deleted.rosters} rosters, ${data.deleted.bids} enchères, ${data.deleted.annonces} annonces, ${data.deleted.auctions} auctions`
      });
      setResetPhrase("");
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  if (loadingPhases) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Auctions */}
      <Card>
        <CardHeader>
          <CardTitle>Enchères en cours</CardTitle>
        </CardHeader>
        <CardContent>
          {!activeAuctions || activeAuctions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune enchère en cours</p>
          ) : (
            <div className="space-y-3">
              {activeAuctions.map((auction) => (
                <div key={auction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Tour {auction.round_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Deadline: {new Date(auction.deadline_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => closeAuction.mutate(auction.id)}
                    disabled={closeAuction.isPending}
                  >
                    {closeAuction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Clôturer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Closed Auctions - Reprocess */}
      {closedAuctions && closedAuctions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Enchères fermées récentes
            </CardTitle>
            <CardDescription>
              Retraiter un round si les annonces n'ont pas été créées correctement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {closedAuctions.map((auction) => (
                <div key={auction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Tour {auction.round_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Clôturé le: {auction.closed_at ? new Date(auction.closed_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => reprocessRound.mutate(auction.id)}
                    disabled={reprocessRound.isPending}
                  >
                    {reprocessRound.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Retraiter
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager Supervision */}
      <AuctionSupervision activePhaseId={activePhase?.id} />

      {/* Auction Creation (Quick Launch + Advanced) */}
      <AuctionCreator activePhase={activePhase} nextRoundNumber={nextRoundNumber} phases={phases} />

      {/* Reset Phase */}
      {activePhase && (() => {
        const expectedPhrase = `RESET PHASE ${activePhase.index_dans_saison} ${activePhase.saisons?.annee || ''}`.trim();
        return (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Zone dangereuse
              </CardTitle>
              <CardDescription>
                Remise à zéro complète de la phase en cours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Réinitialiser Phase {activePhase.index_dans_saison} {activePhase.saisons?.annee}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>⚠️ Confirmer la réinitialisation</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4">
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="destructive" className="text-xs">⚠️ PHASE ACTIVE</Badge>
                        </div>
                        <p className="font-semibold text-foreground">
                          Phase {activePhase.index_dans_saison} {activePhase.saisons?.annee}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Du {new Date(activePhase.date_debut).toLocaleDateString()} au {new Date(activePhase.date_fin).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-foreground">Cette action va <strong>supprimer définitivement</strong> :</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Tous les rosters des managers</li>
                        <li>Toutes les enchères (gagnées et perdues)</li>
                        <li>Toutes les annonces publiées</li>
                        <li>Toutes les auctions créées</li>
                      </ul>
                      <p className="text-destructive font-semibold">Cette action est IRRÉVERSIBLE.</p>
                      <div className="mt-4">
                        <Label htmlFor="reset-phrase">
                          Tapez <code className="bg-muted px-2 py-1 rounded text-xs">{expectedPhrase}</code> pour confirmer :
                        </Label>
                        <Input
                          id="reset-phrase"
                          value={resetPhrase}
                          onChange={(e) => setResetPhrase(e.target.value)}
                          placeholder={expectedPhrase}
                          className="mt-2"
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setResetPhrase("")}>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => resetPhase.mutate()}
                      disabled={resetPhrase !== expectedPhrase || resetPhase.isPending}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {resetPhase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmer la suppression
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
};

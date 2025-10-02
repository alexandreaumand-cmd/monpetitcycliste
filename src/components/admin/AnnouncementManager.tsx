import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Megaphone, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const AnnouncementManager = () => {
  const queryClient = useQueryClient();
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>("");
  const [currentAnnouncementText, setCurrentAnnouncementText] = useState("");

  const { data: closedAuctions, isLoading: loadingAuctions } = useQuery({
    queryKey: ['closed-auctions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('*, phases(*, saisons(*))')
        .eq('statut', 'closed')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: annonces } = useQuery({
    queryKey: ['annonces', selectedAuctionId],
    queryFn: async () => {
      if (!selectedAuctionId) return null;
      const { data, error } = await supabase
        .from('annonces')
        .select('*, coureurs(*), managers(*)')
        .eq('auction_id', selectedAuctionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAuctionId
  });

  const unpublished = annonces?.filter(a => !a.published) || [];
  const published = annonces?.filter(a => a.published) || [];
  const nextAnnonce = unpublished[0];

  const publishNextMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('publier-annonce', {
        body: { auction_id: selectedAuctionId, publish_all: false }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success && data.text) {
        setCurrentAnnouncementText(data.text);
        toast({ title: "Annonce publiée" });
        queryClient.invalidateQueries({ queryKey: ['annonces'] });
      } else {
        toast({ title: "Aucune annonce à publier" });
      }
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const publishAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('publier-annonce', {
        body: { auction_id: selectedAuctionId, publish_all: true }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: `${data.count} annonces publiées` });
      queryClient.invalidateQueries({ queryKey: ['annonces'] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentAnnouncementText);
    toast({ title: "Texte copié" });
  };

  if (loadingAuctions) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sélectionner un round clôturé</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedAuctionId} onValueChange={setSelectedAuctionId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un round" />
            </SelectTrigger>
            <SelectContent>
              {closedAuctions?.map((auction) => (
                <SelectItem key={auction.id} value={auction.id}>
                  Phase {auction.phases?.index_dans_saison} - Round {auction.round_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedAuctionId && annonces && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Prochaine annonce</span>
                <Badge variant="outline">
                  {unpublished.length} restante(s)
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {nextAnnonce ? (
                <>
                  <Alert>
                    <AlertDescription className="text-sm">
                      <strong>{nextAnnonce.coureurs?.nom}</strong>
                      {nextAnnonce.type === 'gain' && nextAnnonce.managers && (
                        <span> - Gagné par {nextAnnonce.managers.nom}</span>
                      )}
                      {nextAnnonce.type === 'egalite' && (
                        <span className="text-orange-600"> - Égalité</span>
                      )}
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => publishNextMutation.mutate()}
                      disabled={publishNextMutation.isPending}
                      className="flex-1 gap-2"
                    >
                      <Megaphone className="h-4 w-4" />
                      Annoncer ce lot
                    </Button>
                    {unpublished.length > 1 && (
                      <Button 
                        onClick={() => publishAllMutation.mutate()}
                        disabled={publishAllMutation.isPending}
                        variant="outline"
                      >
                        Tout annoncer ({unpublished.length})
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  Toutes les annonces ont été publiées
                </p>
              )}

              {currentAnnouncementText && (
                <Card className="bg-muted">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <pre className="text-sm whitespace-pre-wrap flex-1">{currentAnnouncementText}</pre>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={copyToClipboard}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {published.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historique ({published.length} publiée(s))</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {published.map((annonce) => (
                    <div key={annonce.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{annonce.coureurs?.nom}</p>
                        {annonce.type === 'gain' && annonce.managers && (
                          <p className="text-sm text-muted-foreground">
                            {annonce.managers.nom} - {annonce.winning_amount?.toFixed(1)} €
                          </p>
                        )}
                        {annonce.type === 'egalite' && (
                          <p className="text-sm text-orange-600">Égalité</p>
                        )}
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
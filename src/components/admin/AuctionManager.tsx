import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const AuctionManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPhase, setSelectedPhase] = useState("");
  const [roundNumber, setRoundNumber] = useState("1");
  const [deadlineHours, setDeadlineHours] = useState("24");

  const { data: phases, isLoading: loadingPhases } = useQuery({
    queryKey: ['phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .order('date_debut', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: activeAuctions } = useQuery({
    queryKey: ['active-auctions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select(`
          *,
          phases(index_dans_saison, saisons(annee))
        `)
        .eq('statut', 'open')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const createAuction = useMutation({
    mutationFn: async () => {
      if (!selectedPhase) {
        throw new Error("Veuillez sélectionner une phase");
      }

      const deadlineAt = new Date();
      deadlineAt.setHours(deadlineAt.getHours() + parseInt(deadlineHours));

      const { error } = await supabase
        .from('auctions')
        .insert({
          phase_id: selectedPhase,
          round_number: parseInt(roundNumber),
          deadline_at: deadlineAt.toISOString(),
          statut: 'open'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-auctions'] });
      toast({
        title: "Enchère créée",
        description: "L'enchère a été lancée avec succès"
      });
      setRoundNumber((prev) => (parseInt(prev) + 1).toString());
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const closeAuction = useMutation({
    mutationFn: async (auctionId: string) => {
      const { error } = await supabase
        .from('auctions')
        .update({ 
          statut: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', auctionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-auctions'] });
      toast({
        title: "Enchère clôturée",
        description: "L'enchère a été clôturée avec succès"
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
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
      <Card>
        <CardHeader>
          <CardTitle>Lancer une nouvelle enchère</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Phase</Label>
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une phase" />
              </SelectTrigger>
              <SelectContent>
                {phases?.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    Phase {phase.index_dans_saison} ({new Date(phase.date_debut).toLocaleDateString()} - {new Date(phase.date_fin).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Numéro de tour</Label>
              <Input
                type="number"
                min="1"
                value={roundNumber}
                onChange={(e) => setRoundNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Deadline (heures)</Label>
              <Input
                type="number"
                min="1"
                value={deadlineHours}
                onChange={(e) => setDeadlineHours(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={() => createAuction.mutate()}
            disabled={createAuction.isPending || !selectedPhase}
            className="w-full"
          >
            {createAuction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lancer l'enchère
          </Button>
        </CardContent>
      </Card>

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
                    Clôturer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

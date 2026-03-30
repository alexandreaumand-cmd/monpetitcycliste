import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLeague } from "@/contexts/LeagueContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap } from "lucide-react";
import { formatAmount } from "@/lib/utils";

interface AuctionCreatorProps {
  activePhase: any;
  nextRoundNumber: number;
  phases: any[] | undefined;
}

export const AuctionCreator = ({ activePhase, nextRoundNumber, phases }: AuctionCreatorProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();
  const [selectedPhase, setSelectedPhase] = useState("");
  const [roundNumber, setRoundNumber] = useState("1");
  const [deadlineHours, setDeadlineHours] = useState("24");

  const quickLaunchAuction = useMutation({
    mutationFn: async () => {
      if (!activePhase) throw new Error("Aucune phase active. Veuillez d'abord activer une phase.");
      const deadlineAt = new Date();
      deadlineAt.setHours(deadlineAt.getHours() + 24);
      const { error } = await supabase
        .from('auctions')
        .insert({
          phase_id: activePhase.id,
          round_number: nextRoundNumber,
          deadline_at: deadlineAt.toISOString(),
          statut: 'open',
          league_id: leagueId
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-auctions'] });
      toast({ title: "Enchère lancée ! 🚀", description: `Tour ${nextRoundNumber} ouvert avec 24h de deadline` });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  const createAuction = useMutation({
    mutationFn: async () => {
      if (!selectedPhase) throw new Error("Veuillez sélectionner une phase");
      const deadlineAt = new Date();
      deadlineAt.setHours(deadlineAt.getHours() + parseInt(deadlineHours));
      const { error } = await supabase
        .from('auctions')
        .insert({
          phase_id: selectedPhase,
          round_number: parseInt(roundNumber),
          deadline_at: deadlineAt.toISOString(),
          statut: 'open',
          league_id: leagueId
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-auctions'] });
      toast({ title: "Enchère créée", description: "L'enchère a été lancée avec succès" });
      setRoundNumber((prev) => (parseInt(prev) + 1).toString());
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  return (
    <>
      {/* Quick Launch Section */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Lancement Rapide
          </CardTitle>
          <CardDescription>
            {activePhase ? (
              <>Phase active: {new Date(activePhase.date_debut).toLocaleDateString()} - {new Date(activePhase.date_fin).toLocaleDateString()}</>
            ) : (
              "Aucune phase active"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activePhase ? (
            <>
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                <div>
                  <p className="font-medium">Prochain tour: {nextRoundNumber}</p>
                  <p className="text-sm text-muted-foreground">Deadline: 24h automatique</p>
                </div>
                <Badge variant="outline">{formatAmount(activePhase.budget)} de budget</Badge>
              </div>
              <Button
                onClick={() => quickLaunchAuction.mutate()}
                disabled={quickLaunchAuction.isPending}
                size="lg"
                className="w-full"
              >
                {quickLaunchAuction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Zap className="mr-2 h-4 w-4" />
                Lancer le Tour {nextRoundNumber}
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">Aucune phase active. Veuillez d'abord activer une phase dans l'onglet Saisons.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Options */}
      <Card>
        <CardHeader>
          <CardTitle>Options avancées</CardTitle>
          <CardDescription>Personnaliser les paramètres de l'enchère</CardDescription>
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
              <Input type="number" min="1" value={roundNumber} onChange={(e) => setRoundNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Deadline (heures)</Label>
              <Input type="number" min="1" value={deadlineHours} onChange={(e) => setDeadlineHours(e.target.value)} />
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
    </>
  );
};

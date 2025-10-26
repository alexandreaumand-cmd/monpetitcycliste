import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Trash2 } from "lucide-react";

export const AuctionResetManager = () => {
  const [phaseId, setPhaseId] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const { toast } = useToast();

  // Fetch leagues
  const { data: leagues } = useQuery({
    queryKey: ['leagues-for-reset'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch phases
  const { data: phases } = useQuery({
    queryKey: ['phases-for-reset'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('id, index_dans_saison, saison_id, saisons(annee)')
        .order('index_dans_saison', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Count auctions for selected phase and league
  const { data: auctionCount } = useQuery({
    queryKey: ['auction-count', phaseId, leagueId],
    queryFn: async () => {
      if (!phaseId || !leagueId) return 0;
      const { count, error } = await supabase
        .from('auctions')
        .select('*', { count: 'exact', head: true })
        .eq('phase_id', phaseId)
        .eq('league_id', leagueId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!phaseId && !!leagueId,
  });

  // Reset phase auctions mutation
  const resetPhaseAuctions = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-reset-phase-auctions', {
        body: { phase_id: phaseId, league_id: leagueId, confirm_phrase: confirmPhrase },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Enchères supprimées",
        description: data.message,
      });
      setConfirmPhrase("");
      setPhaseId("");
      setLeagueId("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la suppression", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>🗑️ Reset des enchères d'une phase</CardTitle>
        <CardDescription>
          Supprimer tous les rounds d'enchères, offres et annonces (les rosters ne sont PAS affectés)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Ligue</Label>
          <Select value={leagueId} onValueChange={setLeagueId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une ligue" />
            </SelectTrigger>
            <SelectContent>
              {leagues?.map((league) => (
                <SelectItem key={league.id} value={league.id}>
                  {league.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Phase</Label>
          <Select value={phaseId} onValueChange={setPhaseId} disabled={!leagueId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une phase" />
            </SelectTrigger>
            <SelectContent>
              {phases?.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  Phase {phase.index_dans_saison} - {(phase.saisons as any)?.annee || 'N/A'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {phaseId && leagueId && auctionCount !== undefined && (
          <Alert>
            <AlertDescription>
              <strong>{auctionCount} enchère(s)</strong> trouvée(s) pour cette phase et cette ligue.
            </AlertDescription>
          </Alert>
        )}

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">⚠️ Cette action supprimera :</p>
              <ul className="list-disc list-inside text-sm">
                <li>Tous les rounds d'enchères</li>
                <li>Toutes les offres (bids)</li>
                <li>Toutes les annonces</li>
              </ul>
              <p className="text-sm font-medium mt-2">Les rosters ne seront PAS affectés.</p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Phrase de confirmation</Label>
          <Input
            placeholder="RESET ENCHERES"
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Tapez exactement: <code>RESET ENCHERES</code>
          </p>
        </div>

        <Button
          variant="destructive"
          disabled={confirmPhrase !== 'RESET ENCHERES' || !phaseId || !leagueId || resetPhaseAuctions.isPending}
          onClick={() => resetPhaseAuctions.mutate()}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {resetPhaseAuctions.isPending ? "Suppression..." : "Supprimer les enchères de cette phase"}
        </Button>
      </CardContent>
    </Card>
  );
};

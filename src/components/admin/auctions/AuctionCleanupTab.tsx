import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

export const AuctionCleanupTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const { leagues: userLeagues } = useUserLeagues();

  const [leagueId, setLeagueId] = useState<string>("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [confirmPhrase, setConfirmPhrase] = useState("");

  // Fetch all leagues for superadmin, or use user leagues for others
  const { data: allLeagues } = useQuery({
    queryKey: ['admin-all-leagues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const availableLeagues = isSuperAdmin 
    ? allLeagues || []
    : userLeagues.filter(l => l.role === 'owner' || l.role === 'admin');

  // Fetch phases
  const { data: phases } = useQuery({
    queryKey: ['admin-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select(`
          id,
          index_dans_saison,
          saison_id,
          saisons (annee)
        `)
        .order('index_dans_saison', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Count auctions for selected phase and league
  const { data: auctionCount, refetch: refetchCount } = useQuery({
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

  // Reset mutation
  const { mutate: deleteAuctions, isPending } = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-reset-phase-auctions', {
        body: {
          phase_id: phaseId,
          league_id: leagueId,
          confirm_phrase: confirmPhrase,
        },
      });

      if (error) throw error;
      
      // Check for error in response data
      if (data?.error) {
        const err: any = new Error(data.error);
        err.status = error?.status;
        throw err;
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Enchères supprimées",
        description: data?.message || `${data?.auctions_deleted || 0} round(s) d'enchères supprimé(s)`,
      });
      
      // Reset form
      setPhaseId("");
      setLeagueId("");
      setConfirmPhrase("");
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['auction-count'] });
      refetchCount();
    },
    onError: (error: any) => {
      const status = error?.context?.status ?? error?.status ?? '';
      const serverMsg = error?.context?.body?.error ?? error?.message ?? 'Erreur inconnue';
      
      toast({
        title: "❌ Erreur",
        description: status ? `[${status}] ${serverMsg}` : serverMsg,
        variant: "destructive",
      });
    },
  });

  // Normalize confirmation phrase for non-superadmins
  const normalizedPhrase = isSuperAdmin 
    ? "" 
    : ((confirmPhrase ?? '').toString())
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

  const isDeleteDisabled = 
    !leagueId || 
    !phaseId || 
    isPending || 
    (!isSuperAdmin && normalizedPhrase !== 'RESET ENCHERES');

  const selectedPhase = phases?.find(p => p.id === phaseId);
  const selectedLeague = availableLeagues.find(l => l.id === leagueId);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Cette action supprimera :</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Tous les rounds d'enchères de la phase sélectionnée</li>
            <li>Toutes les offres (bids) associées</li>
            <li>Toutes les annonces liées aux enchères</li>
          </ul>
          <p className="mt-2"><strong>Ne sera PAS supprimé :</strong> Les rosters des managers</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Suppression des enchères d'une phase
          </CardTitle>
          <CardDescription>
            Sélectionnez une ligue et une phase pour supprimer toutes les enchères associées
            {isSuperAdmin && " (phrase de confirmation optionnelle pour les superadmins)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="league-select">Ligue</Label>
              <Select value={leagueId} onValueChange={setLeagueId}>
                <SelectTrigger id="league-select">
                  <SelectValue placeholder="Sélectionnez une ligue" />
                </SelectTrigger>
                <SelectContent>
                  {availableLeagues.map((league) => (
                    <SelectItem key={league.id} value={league.id}>
                      {league.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phase-select">Phase</Label>
              <Select value={phaseId} onValueChange={setPhaseId}>
                <SelectTrigger id="phase-select">
                  <SelectValue placeholder="Sélectionnez une phase" />
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
          </div>

          {leagueId && phaseId && (
            <Alert>
              <AlertDescription>
                <strong>Enchères trouvées :</strong> {auctionCount ?? '...'} round(s)
                {selectedLeague && selectedPhase && (
                  <div className="mt-2 text-sm">
                    Ligue: <span className="font-medium">{selectedLeague.name}</span>
                    {' · '}
                    Phase: <span className="font-medium">
                      {selectedPhase.index_dans_saison} - {(selectedPhase.saisons as any)?.annee}
                    </span>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-phrase">
              Phrase de confirmation
              {isSuperAdmin && <span className="text-muted-foreground ml-2">(optionnel pour superadmin)</span>}
            </Label>
            <Input
              id="confirm-phrase"
              type="text"
              placeholder="RESET ENCHERES"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
            />
            {!isSuperAdmin && (
              <p className="text-xs text-muted-foreground">
                Tapez exactement : <code className="bg-muted px-1 rounded">RESET ENCHERES</code>
              </p>
            )}
          </div>

          <Button
            variant="destructive"
            onClick={() => deleteAuctions()}
            disabled={isDeleteDisabled}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Suppression en cours...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer les enchères de cette phase
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

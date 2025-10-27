import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeague } from "@/contexts/LeagueContext";

export const RoundManager = () => {
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [newDeadline, setNewDeadline] = useState("");
  const [openDialog, setOpenDialog] = useState(false);

  const { data: phases, isLoading: loadingPhases } = useQuery({
    queryKey: ['phases-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('*, saisons(*)')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: currentAuction, isLoading: loadingAuction } = useQuery({
    queryKey: ['current-auction', selectedPhaseId],
    queryFn: async () => {
      if (!selectedPhaseId) return null;
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('phase_id', selectedPhaseId)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!selectedPhaseId
  });

  const { data: stats } = useQuery({
    queryKey: ['auction-stats', currentAuction?.id],
    queryFn: async () => {
      if (!currentAuction?.id) return null;

      const { data: bids } = await supabase
        .from('bids')
        .select('statut')
        .eq('auction_id', currentAuction.id);

      const { data: annonces } = await supabase
        .from('annonces')
        .select('type')
        .eq('auction_id', currentAuction.id);

      return {
        pending: bids?.filter(b => b.statut === 'pending').length || 0,
        won: bids?.filter(b => b.statut === 'won').length || 0,
        carried_over: bids?.filter(b => b.statut === 'carried_over').length || 0,
        gains: annonces?.filter(a => a.type === 'gain').length || 0,
        egalites: annonces?.filter(a => a.type === 'egalite').length || 0
      };
    },
    enabled: !!currentAuction?.id
  });

  const { data: managersStatus } = useQuery({
    queryKey: ['managers-status', currentAuction?.id],
    queryFn: async () => {
      if (!currentAuction?.id) return null;

      const { data: managers } = await supabase
        .from('managers')
        .select('id, nom')
        .order('nom');

      if (!managers) return null;

      const statusPromises = managers.map(async (manager) => {
        const { data: bids } = await supabase
          .from('bids')
          .select('statut')
          .eq('auction_id', currentAuction.id)
          .eq('manager_id', manager.id);

        const hasPending = bids?.some(b => b.statut === 'pending');
        const hasDraft = bids?.some(b => b.statut === 'draft');
        const bidCount = bids?.length || 0;

        return {
          ...manager,
          validated: hasPending,
          hasDraft,
          bidCount
        };
      });

      return Promise.all(statusPromises);
    },
    enabled: !!currentAuction?.id
  });

  const closeRoundMutation = useMutation({
    mutationFn: async (auction_id: string) => {
      const { data, error } = await supabase.functions.invoke('clore-round', {
        body: { 
          auction_id,
          league_id: leagueId
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Round clôturé",
        description: `${data.annonces_count} annonces créées`
      });
      queryClient.invalidateQueries({ queryKey: ['current-auction'] });
      queryClient.invalidateQueries({ queryKey: ['auction-stats'] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const openNewRoundMutation = useMutation({
    mutationFn: async ({ phase_id, deadline_at }: { phase_id: string, deadline_at: string }) => {
      const { data, error } = await supabase.functions.invoke('ouvrir-nouveau-round', {
        body: { 
          phase_id, 
          deadline_at,
          league_id: leagueId
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Nouveau round ouvert" });
      setOpenDialog(false);
      setNewDeadline("");
      queryClient.invalidateQueries({ queryKey: ['current-auction'] });
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
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sélectionner une phase</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une phase" />
            </SelectTrigger>
            <SelectContent>
              {phases?.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  Phase {phase.index_dans_saison} - {phase.saisons?.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedPhaseId && !loadingAuction && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Round en cours</span>
              {currentAuction && (
                <Badge variant={currentAuction.statut === 'open' ? 'default' : 'secondary'}>
                  {currentAuction.statut === 'open' ? 'Ouvert' : 'Fermé'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentAuction ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Round</p>
                    <p className="text-2xl font-bold">#{currentAuction.round_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <p className="font-medium">{new Date(currentAuction.deadline_at).toLocaleString()}</p>
                  </div>
                </div>

                {stats && (
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">En attente</p>
                      <p className="text-xl font-bold">{stats.pending}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Gagnés</p>
                      <p className="text-xl font-bold text-green-600">{stats.gains}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Égalités</p>
                      <p className="text-xl font-bold text-orange-600">{stats.egalites}</p>
                    </div>
                  </div>
                )}

                {managersStatus && currentAuction.statut === 'open' && (
                  <div className="pt-4 border-t space-y-3">
                    <h4 className="font-semibold">État des enchères des managers</h4>
                    
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">✅ Enchères validées ({managersStatus.filter(m => m.validated).length})</p>
                        <div className="flex flex-wrap gap-2">
                          {managersStatus.filter(m => m.validated).map(manager => (
                            <Badge key={manager.id} variant="default" className="gap-1">
                              {manager.nom}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground mb-2">⏳ En attente ({managersStatus.filter(m => !m.validated).length})</p>
                        <div className="flex flex-wrap gap-2">
                          {managersStatus.filter(m => !m.validated).map(manager => (
                            <Badge key={manager.id} variant="secondary" className="gap-1">
                              {manager.nom}
                              {manager.hasDraft && ` (${manager.bidCount} draft)`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentAuction.statut === 'open' && (
                  <Button 
                    onClick={() => closeRoundMutation.mutate(currentAuction.id)}
                    disabled={closeRoundMutation.isPending}
                    className="w-full gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Clôturer le round
                  </Button>
                )}

                {currentAuction.statut === 'closed' && (
                  <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full gap-2">
                        <Plus className="h-4 w-4" />
                        Ouvrir le round suivant
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nouveau round</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Deadline</Label>
                          <Input 
                            type="datetime-local" 
                            value={newDeadline}
                            onChange={(e) => setNewDeadline(e.target.value)}
                          />
                        </div>
                        <Button 
                          onClick={() => openNewRoundMutation.mutate({ 
                            phase_id: selectedPhaseId, 
                            deadline_at: new Date(newDeadline).toISOString() 
                          })}
                          disabled={!newDeadline || openNewRoundMutation.isPending}
                          className="w-full"
                        >
                          Créer le round {currentAuction.round_number + 1}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Aucun round pour cette phase</p>
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Créer le premier round
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Premier round</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Deadline</Label>
                        <Input 
                          type="datetime-local" 
                          value={newDeadline}
                          onChange={(e) => setNewDeadline(e.target.value)}
                        />
                      </div>
                      <Button 
                        onClick={() => openNewRoundMutation.mutate({ 
                          phase_id: selectedPhaseId, 
                          deadline_at: new Date(newDeadline).toISOString() 
                        })}
                        disabled={!newDeadline || openNewRoundMutation.isPending}
                        className="w-full"
                      >
                        Créer le round 1
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
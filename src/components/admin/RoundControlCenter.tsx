import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { RoundHeader } from "./rounds/RoundHeader";
import { RoundStats } from "./rounds/RoundStats";
import { RoundActions } from "./rounds/RoundActions";
import { ManagersSupervision } from "./rounds/ManagersSupervision";
import { AnnouncementsLive } from "./rounds/AnnouncementsLive";
import { PhaseSelector } from "./rounds/PhaseSelector";
import { Card, CardContent } from "@/components/ui/card";

export const RoundControlCenter = () => {
  const queryClient = useQueryClient();
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [currentAnnouncementText, setCurrentAnnouncementText] = useState("");

  // Fetch phases
  const { data: phases, isLoading: loadingPhases } = useQuery({
    queryKey: ['phases-with-seasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('*, saisons(*)')
        .order('index_dans_saison', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Auto-select first phase
  useEffect(() => {
    if (phases && phases.length > 0 && !selectedPhaseId) {
      setSelectedPhaseId(phases[0].id);
    }
  }, [phases, selectedPhaseId]);

  // Fetch current auction for selected phase
  const { data: currentAuction, isLoading: loadingAuction } = useQuery({
    queryKey: ['current-auction', selectedPhaseId],
    queryFn: async () => {
      if (!selectedPhaseId) return null;
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('phase_id', selectedPhaseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPhaseId,
    refetchInterval: 10000 // Auto-refresh every 10s
  });

  // Fetch auction stats
  const { data: stats } = useQuery({
    queryKey: ['auction-stats', currentAuction?.id],
    queryFn: async () => {
      if (!currentAuction?.id) return null;
      const { data, error } = await supabase.functions.invoke('auction-get-validation-status', {
        body: { phase_id: selectedPhaseId }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!currentAuction?.id && currentAuction?.statut === 'open',
    refetchInterval: 10000
  });

  // Fetch real manager statuses
  const { data: managerStatuses, isLoading: loadingManagers } = useQuery({
    queryKey: ['manager-statuses', currentAuction?.id, selectedPhaseId],
    queryFn: async () => {
      if (!currentAuction?.id || !selectedPhaseId) return [];
      
      const { data, error } = await supabase.functions.invoke('auction-get-managers-status', {
        body: { 
          auction_id: currentAuction.id,
          phase_id: selectedPhaseId 
        }
      });
      
      if (error) throw error;
      return data.managers || [];
    },
    enabled: !!currentAuction?.id && !!selectedPhaseId && currentAuction?.statut === 'open',
    refetchInterval: 10000, // Refresh toutes les 10s
  });

  // Fetch announcements
  const { data: announcements } = useQuery({
    queryKey: ['announcements', currentAuction?.id],
    queryFn: async () => {
      if (!currentAuction?.id || currentAuction.statut !== 'closed') return [];
      
      const { data, error } = await supabase
        .from('annonces')
        .select('*, coureurs(nom), managers(nom)')
        .eq('auction_id', currentAuction.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      return data.map(a => ({
        id: a.id,
        type: a.type as 'gain' | 'egalite',
        coureur_nom: a.coureurs?.nom || '',
        manager_nom: a.managers?.nom,
        winning_amount: a.winning_amount,
        published: a.published
      }));
    },
    enabled: !!currentAuction?.id,
    refetchInterval: 5000
  });

  // Mutations
  const openRoundMutation = useMutation({
    mutationFn: async (deadlineAt: string) => {
      const { data, error } = await supabase.functions.invoke('ouvrir-nouveau-round', {
        body: { 
          phase_id: selectedPhaseId, 
          deadline_at: deadlineAt 
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "✅ Nouveau round lancé" });
      queryClient.invalidateQueries({ queryKey: ['current-auction'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const closeRoundMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('clore-round', {
        body: { auction_id: currentAuction?.id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "✅ Round clôturé avec succès" });
      queryClient.invalidateQueries({ queryKey: ['current-auction'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const publishNextMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('publier-annonce', {
        body: { auction_id: currentAuction?.id, publish_all: false }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success && data.text) {
        setCurrentAnnouncementText(data.text);
        toast({ title: "📢 Annonce publiée" });
        queryClient.invalidateQueries({ queryKey: ['announcements'] });
      } else {
        toast({ title: "Aucune annonce à publier" });
      }
    },
    onError: (error: Error) => {
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
        body: { auction_id: currentAuction?.id, publish_all: true }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: `📢 ${data.count} annonces publiées` });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentAnnouncementText);
    toast({ title: "✅ Texte copié" });
  };

  if (loadingPhases) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const selectedPhase = phases?.find(p => p.id === selectedPhaseId);
  const isLoading = openRoundMutation.isPending || closeRoundMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Phase Selector */}
      {phases && phases.length > 0 && (
        <PhaseSelector
          phases={phases}
          selectedPhaseId={selectedPhaseId}
          onPhaseChange={setSelectedPhaseId}
          currentAuction={currentAuction}
          isLoading={loadingPhases || loadingAuction}
        />
      )}

      {/* Actions - Always visible when a phase is selected */}
      {selectedPhaseId && (
        <RoundActions
          isOpen={currentAuction?.statut === 'open'}
          canLaunch={!currentAuction || currentAuction.statut !== 'open'}
          canClose={currentAuction?.statut === 'open'}
          onLaunch={(hours) => openRoundMutation.mutate(hours)}
          onClose={() => closeRoundMutation.mutate()}
          isLoading={isLoading}
        />
      )}

      {selectedPhaseId && currentAuction && (
        <>
          {/* Header */}
          <RoundHeader
            phaseName={`Phase ${selectedPhase?.index_dans_saison || 0}`}
            phaseIndex={selectedPhase?.index_dans_saison || 0}
            roundNumber={currentAuction.round_number}
            deadline={currentAuction.deadline_at}
            isOpen={currentAuction.statut === 'open'}
          />

          {/* Stats */}
          {currentAuction.statut === 'open' && stats && (
            <RoundStats
              pendingBids={stats.pending_bids || 0}
              wonBids={stats.won_bids || 0}
              ties={stats.ties || 0}
              totalManagers={managerStatuses?.length || 0}
              validatedManagers={stats.validated_managers || 0}
            />
          )}

          {/* 3 Columns Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Stats (already above on mobile) - hidden on large screens */}
            <div className="lg:hidden">
              {/* Stats already shown above */}
            </div>

            {/* Column 2: Managers Supervision */}
            {currentAuction.statut === 'open' && (
              <div className="lg:col-span-2">
                <ManagersSupervision
                  managers={managerStatuses || []}
                  isLoading={loadingManagers}
                />
              </div>
            )}

            {/* Column 3: Announcements */}
            {currentAuction.statut === 'closed' && announcements && announcements.length > 0 && (
              <div className="lg:col-span-1">
                <AnnouncementsLive
                  announcements={announcements}
                  currentText={currentAnnouncementText}
                  onPublishNext={() => publishNextMutation.mutate()}
                  onPublishAll={() => publishAllMutation.mutate()}
                  onCopy={copyToClipboard}
                  isLoading={publishNextMutation.isPending || publishAllMutation.isPending}
                />
              </div>
            )}
          </div>
        </>
      )}

      {selectedPhaseId && !currentAuction && !loadingAuction && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun round actif pour cette phase.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

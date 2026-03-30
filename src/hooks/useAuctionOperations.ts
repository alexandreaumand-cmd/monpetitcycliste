import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLeague } from "@/contexts/LeagueContext";

export const useAuctionOperations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();
  const [selectedPhase, setSelectedPhase] = useState("");
  const [roundNumber, setRoundNumber] = useState("1");
  const [deadlineHours, setDeadlineHours] = useState("24");
  const [resetPhrase, setResetPhrase] = useState("");

  const { data: phases, isLoading: loadingPhases } = useQuery({
    queryKey: ['phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('*, saisons(annee)')
        .eq('statut', 'active')
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
        .select(`*, phases(index_dans_saison, saisons(annee))`)
        .eq('statut', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: closedAuctions } = useQuery({
    queryKey: ['closed-auctions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select(`*, phases(index_dans_saison, saisons(annee))`)
        .eq('statut', 'closed')
        .order('closed_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    }
  });

  const activePhase = phases?.[0];
  const nextRoundNumber = (activeAuctions?.filter(a => a.phase_id === activePhase?.id).length || 0) + 1;

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

  const closeAuction = useMutation({
    mutationFn: async (auctionId: string) => {
      const { error: updateError } = await supabase
        .from('auctions')
        .update({ statut: 'closed', closed_at: new Date().toISOString() })
        .eq('id', auctionId);
      if (updateError) throw updateError;
      const { data, error: functionError } = await supabase.functions.invoke('clore-round', {
        body: { auction_id: auctionId, league_id: leagueId }
      });
      if (functionError) throw functionError;
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

  return {
    phases,
    loadingPhases,
    activeAuctions,
    closedAuctions,
    activePhase,
    nextRoundNumber,
    selectedPhase,
    setSelectedPhase,
    roundNumber,
    setRoundNumber,
    deadlineHours,
    setDeadlineHours,
    resetPhrase,
    setResetPhrase,
    quickLaunchAuction,
    createAuction,
    closeAuction,
    reprocessRound,
    resetPhase,
  };
};

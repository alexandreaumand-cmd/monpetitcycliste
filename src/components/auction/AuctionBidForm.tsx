import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Trash2, CheckCircle2, Edit2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "use-debounce";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

interface AuctionBidFormProps {
  auction: {
    id: string;
    round_number: number;
    phase_id: string;
    deadline_at: string;
  };
  managerId: string;
}

export const AuctionBidForm = ({ auction, managerId }: AuctionBidFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCoureur, setSelectedCoureur] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [editingBidId, setEditingBidId] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Normalize string: remove accents and convert to lowercase
  const normalizeString = (str: string) => 
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // Custom filter function for Command component
  const filterFunction = (value: string, search: string) => {
    const normalizedValue = normalizeString(value);
    const normalizedSearch = normalizeString(search);
    return normalizedValue.includes(normalizedSearch) ? 1 : 0;
  };

  const { data: coureurs, isLoading: loadingCoureurs } = useQuery({
    queryKey: ['coureurs-search', debouncedSearchTerm],
    queryFn: async () => {
      let query = supabase
        .from('coureurs')
        .select('*');
      
      if (debouncedSearchTerm && debouncedSearchTerm.length >= 2) {
        const normalizedSearch = `%${debouncedSearchTerm}%`;
        query = query.or(`nom.ilike.${normalizedSearch},equipe.ilike.${normalizedSearch}`);
      }
      
      const { data, error } = await query
        .order('nom')
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: draftBids = [], isLoading: loadingDraftBids } = useQuery({
    queryKey: ['draft-bids', auction.id, managerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('*, coureurs(nom, prix_initial, equipe)')
        .eq('auction_id', auction.id)
        .eq('manager_id', managerId)
        .eq('round_number', auction.round_number)
        .eq('statut', 'draft')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const { data: submittedBids = [] } = useQuery({
    queryKey: ['submitted-bids', auction.id, managerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('*, coureurs(nom, prix_initial, equipe)')
        .eq('auction_id', auction.id)
        .eq('manager_id', managerId)
        .eq('round_number', auction.round_number)
        .eq('statut', 'pending');

      if (error) throw error;
      return data || [];
    }
  });

  const { data: budget, isLoading: loadingBudget } = useQuery({
    queryKey: ['manager-budget', managerId, auction.phase_id, draftBids.length, submittedBids.length],
    queryFn: async () => {
      // Get phase budget
      const { data: phase, error: phaseError } = await supabase
        .from('phases')
        .select('budget, max_coureurs')
        .eq('id', auction.phase_id)
        .single();

      if (phaseError) throw phaseError;

      // Get spent amount from rosters
      const { data: rosters, error: rosterError } = await supabase
        .from('rosters')
        .select('prix_signature')
        .eq('manager_id', managerId)
        .eq('phase_id', auction.phase_id);

      if (rosterError) throw rosterError;

      const spentOnRosters = rosters?.reduce((sum, r) => sum + parseFloat(r.prix_signature.toString()), 0) || 0;
      
      // Calculate reserved budget from draft and submitted bids
      const reservedInDrafts = draftBids.reduce((sum: number, b: any) => sum + parseFloat(b.montant.toString()), 0);
      const reservedInSubmitted = submittedBids.reduce((sum: number, b: any) => sum + parseFloat(b.montant.toString()), 0);
      
      const totalReserved = spentOnRosters + reservedInDrafts + reservedInSubmitted;
      const remaining = parseFloat(phase.budget.toString()) - totalReserved;

      return {
        total: parseFloat(phase.budget.toString()),
        spent: spentOnRosters,
        reserved: reservedInDrafts + reservedInSubmitted,
        remaining,
        maxCoureurs: phase.max_coureurs || 30
      };
    },
    enabled: true
  });

  useEffect(() => {
    if (selectedCoureur && !bidAmount && !editingBidId) {
      setBidAmount(selectedCoureur.prix_initial.toString());
    }
  }, [selectedCoureur, editingBidId]);

  const addOrUpdateBid = useMutation({
    mutationFn: async () => {
      if (!selectedCoureur) {
        throw new Error("Veuillez sélectionner un coureur");
      }

      const amount = parseFloat(bidAmount);
      if (isNaN(amount) || amount < parseFloat(selectedCoureur.prix_initial)) {
        throw new Error(`Le montant doit être au moins ${selectedCoureur.prix_initial}`);
      }

      if (budget && amount > budget.remaining) {
        throw new Error("Budget insuffisant");
      }

      if (editingBidId) {
        // Update existing draft bid
        const { error } = await supabase
          .from('bids')
          .update({
            coureur_id: selectedCoureur.id,
            montant: amount,
          })
          .eq('id', editingBidId);

        if (error) throw error;
      } else {
        // Add new draft bid
        const { error } = await supabase
          .from('bids')
          .insert({
            auction_id: auction.id,
            manager_id: managerId,
            coureur_id: selectedCoureur.id,
            montant: amount,
            round_number: auction.round_number,
            statut: 'draft'
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-bids'] });
      queryClient.invalidateQueries({ queryKey: ['manager-budget'] });
      toast({
        title: editingBidId ? "Enchère modifiée" : "Enchère ajoutée",
        description: editingBidId ? "Votre enchère a été modifiée" : "Votre enchère a été ajoutée aux brouillons"
      });
      setSelectedCoureur(null);
      setBidAmount("");
      setEditingBidId(null);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteBid = useMutation({
    mutationFn: async (bidId: string) => {
      const { error } = await supabase
        .from('bids')
        .delete()
        .eq('id', bidId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-bids'] });
      queryClient.invalidateQueries({ queryKey: ['manager-budget'] });
      toast({
        title: "Enchère supprimée",
        description: "L'enchère a été supprimée"
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

  const submitAllBids = useMutation({
    mutationFn: async () => {
      if (draftBids.length === 0) {
        throw new Error("Aucune enchère en brouillon");
      }

      // Update all draft bids to pending
      const bidIds = draftBids.map((b: any) => b.id);
      const { error } = await supabase
        .from('bids')
        .update({ statut: 'pending' })
        .in('id', bidIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-bids'] });
      queryClient.invalidateQueries({ queryKey: ['submitted-bids'] });
      queryClient.invalidateQueries({ queryKey: ['manager-budget'] });
      setShowSubmitDialog(false);
      toast({
        title: "Enchères validées",
        description: `${draftBids.length} enchère(s) ont été soumises`
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

  const handleEditBid = (bid: any) => {
    setEditingBidId(bid.id);
    setSelectedCoureur(bid.coureurs);
    setBidAmount(bid.montant.toString());
  };

  const handleCancelEdit = () => {
    setEditingBidId(null);
    setSelectedCoureur(null);
    setBidAmount("");
  };

  const totalBidsCount = draftBids.length + submittedBids.length;
  const canAddMore = budget ? totalBidsCount < budget.maxCoureurs : false;

  // If there are submitted bids, show them in read-only mode
  if (submittedBids.length > 0 && draftBids.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Vos enchères validées - Tour {auction.round_number}</span>
            <Badge variant="secondary" className="text-base">
              {submittedBids.length} enchère(s)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {submittedBids.map((bid: any) => (
              <div key={bid.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{bid.coureurs.nom}</p>
                  <p className="text-sm text-muted-foreground">{bid.coureurs.equipe}</p>
                </div>
                <Badge variant="outline" className="text-lg">
                  {parseFloat(bid.montant.toString()).toFixed(0)} €
                </Badge>
              </div>
            ))}
            <p className="text-sm text-muted-foreground text-center pt-2">
              Enchères en attente de traitement
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Préparer mes enchères - Tour {auction.round_number}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {totalBidsCount}/{budget?.maxCoureurs || 30} coureurs
              </Badge>
              {loadingBudget ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Badge variant={budget && budget.remaining < 0 ? "destructive" : "secondary"} className="text-sm">
                  Budget: {budget?.remaining.toFixed(0) || '0'} €
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* List of draft bids */}
          {draftBids.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base">Enchères en préparation ({draftBids.length})</Label>
                {draftBids.length > 0 && (
                  <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Valider toutes mes enchères
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmer la validation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Vous êtes sur le point de soumettre {draftBids.length} enchère(s) pour un montant total de {draftBids.reduce((sum: number, b: any) => sum + parseFloat(b.montant.toString()), 0).toFixed(0)} €.
                          <br /><br />
                          Budget restant après validation: {budget ? (budget.remaining).toFixed(0) : '0'} €
                          <br /><br />
                          Une fois validées, vous ne pourrez plus les modifier.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => submitAllBids.mutate()}>
                          Confirmer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {draftBids.map((bid: any) => (
                  <div key={bid.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{bid.coureurs.nom}</p>
                      <p className="text-sm text-muted-foreground">{bid.coureurs.equipe}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {parseFloat(bid.montant.toString()).toFixed(0)} €
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditBid(bid)}
                        disabled={editingBidId === bid.id}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteBid.mutate(bid.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          )}

          {/* Add/Edit bid form */}
          {canAddMore || editingBidId ? (
            <>
              <div className="space-y-2">
                <Label>{editingBidId ? "Modifier l'enchère" : "Ajouter une enchère"}</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      {selectedCoureur ? (
                        <div className="flex items-center justify-between w-full">
                          <span>{selectedCoureur.nom}</span>
                          <span className="text-muted-foreground text-sm">{selectedCoureur.equipe}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sélectionner un coureur...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[400px]" align="start">
                    <Command filter={filterFunction} shouldFilter={false}>
                      <CommandInput 
                        placeholder="Rechercher un coureur..." 
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {loadingCoureurs ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : debouncedSearchTerm.length < 2 ? (
                            "Tapez au moins 2 lettres pour rechercher"
                          ) : (
                            "Aucun coureur trouvé"
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {coureurs?.map((coureur) => (
                            <CommandItem
                              key={coureur.id}
                              value={`${coureur.nom} ${coureur.equipe || ''}`}
                              onSelect={() => {
                                setSelectedCoureur(coureur);
                                setOpen(false);
                                setSearchTerm("");
                              }}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div>
                                  <p className="font-medium">{coureur.nom}</p>
                                  <p className="text-sm text-muted-foreground">{coureur.equipe}</p>
                                </div>
                                <Badge variant="secondary">
                                  Min: {parseFloat(coureur.prix_initial.toString()).toFixed(0)} €
                                </Badge>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedCoureur && (
                <>
                  <div className="p-3 bg-muted rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Équipe:</span>
                      <span className="font-medium">{selectedCoureur.equipe}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cote minimum:</span>
                      <span className="font-medium flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {parseFloat(selectedCoureur.prix_initial).toFixed(0)} €
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Montant de l'enchère (€)</Label>
                    <Input
                      type="number"
                      min={selectedCoureur.prix_initial}
                      step="0.01"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={`Minimum: ${selectedCoureur.prix_initial}`}
                    />
                  </div>

                  {budget && bidAmount && parseFloat(bidAmount) > budget.remaining && (
                    <p className="text-sm text-destructive">
                      ⚠️ Budget insuffisant (reste: {budget.remaining.toFixed(0)} €)
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => addOrUpdateBid.mutate()}
                      disabled={addOrUpdateBid.isPending || !selectedCoureur || !bidAmount}
                      className="flex-1"
                    >
                      {addOrUpdateBid.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingBidId ? "Modifier l'enchère" : "Ajouter l'enchère"}
                    </Button>
                    {editingBidId && (
                      <Button
                        onClick={handleCancelEdit}
                        variant="outline"
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Vous avez atteint le nombre maximum de coureurs ({budget?.maxCoureurs || 30})
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Deadline: {new Date(auction.deadline_at).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
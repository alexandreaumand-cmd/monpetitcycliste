import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Trash2, CheckCircle2, Edit2, Clock, Lock, Users } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "use-debounce";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BidHistory } from "./BidHistory";

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
    queryKey: ['coureurs-disponibilite', debouncedSearchTerm, auction.phase_id],
    queryFn: async () => {
      let query = supabase
        .from('coureurs_disponibilite')
        .select('*')
        .eq('phase_id', auction.phase_id);
      
      if (debouncedSearchTerm && debouncedSearchTerm.length >= 2) {
        const normalizedSearch = normalizeString(debouncedSearchTerm);
        query = query.ilike('search_text', `%${normalizedSearch}%`);
      }
      
      const { data, error } = await query
        .order('coureur_nom')
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

  // Get manager phase status (slots, budget)
  const { data: phaseStatus, isLoading: loadingBudget } = useQuery({
    queryKey: ['manager-phase-status', managerId, auction.phase_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_phase_status')
        .select('*')
        .eq('manager_id', managerId)
        .eq('phase_id', auction.phase_id)
        .single();

      if (error) throw error;
      return data;
    }
  });

  // Get current round drafts summary
  const { data: roundDrafts } = useQuery({
    queryKey: ['current-round-drafts', managerId, auction.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_round_drafts')
        .select('*')
        .eq('manager_id', managerId)
        .eq('auction_id', auction.id)
        .maybeSingle();

      if (error) throw error;
      return data || { draft_count: 0, draft_sum: 0 };
    }
  });

  // Get all managers rosters for this phase
  const { data: allManagersRosters = [] } = useQuery({
    queryKey: ['all-managers-rosters', auction.phase_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rosters')
        .select(`
          *,
          coureurs(nom, equipe),
          managers(nom)
        `)
        .eq('phase_id', auction.phase_id)
        .order('manager_id');

      if (error) throw error;
      return data || [];
    }
  });

  // Group rosters by manager
  const rostersByManager = allManagersRosters
    .filter((r: any) => r.manager_id !== managerId)
    .reduce((acc: any, roster: any) => {
      const managerId = roster.manager_id;
      if (!acc[managerId]) {
        acc[managerId] = {
          managerName: roster.managers?.nom || 'Inconnu',
          rosters: []
        };
      }
      acc[managerId].rosters.push(roster);
      return acc;
    }, {});

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

      // Check if coureur is taken
      if (selectedCoureur.is_taken) {
        throw new Error(`Ce coureur a déjà été attribué à ${selectedCoureur.taken_by_manager_nom}`);
      }

      const amount = parseFloat(bidAmount);
      if (isNaN(amount) || amount < parseFloat(selectedCoureur.prix_initial.toString())) {
        throw new Error(`Le montant doit être au moins ${selectedCoureur.prix_initial}`);
      }

      if (phaseStatus && amount > parseFloat(phaseStatus.budget_restant.toString())) {
        throw new Error("Budget insuffisant");
      }

      // Check if adding a new bid would exceed slots_restants
      if (!editingBidId && phaseStatus && roundDrafts) {
        if (roundDrafts.draft_count >= phaseStatus.slots_restants) {
          throw new Error(`Vous avez déjà saisi ${phaseStatus.slots_restants} enchère(s) pour ce round.`);
        }
      }

      // Check for duplicates in draft bids (excluding current editing bid)
      const { data: existingBid } = await supabase
        .from('bids')
        .select('id')
        .eq('manager_id', managerId)
        .eq('auction_id', auction.id)
        .eq('coureur_id', selectedCoureur.coureur_id)
        .eq('statut', 'draft')
        .maybeSingle();

      if (existingBid && existingBid.id !== editingBidId) {
        throw new Error("Vous avez déjà une enchère en brouillon pour ce coureur.");
      }

      if (editingBidId) {
        // Update existing draft bid
        const { error } = await supabase
          .from('bids')
          .update({
            coureur_id: selectedCoureur.coureur_id,
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
            coureur_id: selectedCoureur.coureur_id,
            montant: amount,
            round_number: auction.round_number,
            statut: 'draft'
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-bids'] });
      queryClient.invalidateQueries({ queryKey: ['manager-phase-status'] });
      queryClient.invalidateQueries({ queryKey: ['current-round-drafts'] });
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
      queryClient.invalidateQueries({ queryKey: ['manager-phase-status'] });
      queryClient.invalidateQueries({ queryKey: ['current-round-drafts'] });
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
      if (!phaseStatus) {
        throw new Error("Impossible de charger le statut de votre phase");
      }

      if (draftBids.length === 0) {
        throw new Error("Aucune enchère en brouillon");
      }

      // Validation stricte: le nombre d'enchères doit être égal à slots_restants
      if (draftBids.length !== phaseStatus.slots_restants) {
        throw new Error(`Tu dois soumettre exactement ${phaseStatus.slots_restants} enchère(s).`);
      }

      // Validation stricte: la somme doit être égale au budget_restant
      const draftSum = draftBids.reduce((sum: number, b: any) => sum + parseFloat(b.montant.toString()), 0);
      const budgetRestant = parseFloat(phaseStatus.budget_restant.toString());
      
      // Allow small rounding errors (< 1 euro)
      if (Math.abs(draftSum - budgetRestant) >= 1) {
        throw new Error(`La somme de tes offres (${draftSum.toFixed(0)} €) doit être égale à ton budget restant (${budgetRestant.toFixed(0)} €).`);
      }

      // Vérifier que chaque montant >= prix_initial
      for (const bid of draftBids) {
        if (parseFloat(bid.montant.toString()) < parseFloat(bid.coureurs.prix_initial.toString())) {
          throw new Error(`Le montant pour ${bid.coureurs.nom} doit être au moins ${bid.coureurs.prix_initial} €`);
        }
      }

      // Vérifier qu'aucun coureur n'est déjà attribué
      const coureurIds = draftBids.map((b: any) => b.coureur_id);
      const { data: existingRosters } = await supabase
        .from('rosters')
        .select('coureur_id')
        .eq('phase_id', auction.phase_id)
        .in('coureur_id', coureurIds);

      if (existingRosters && existingRosters.length > 0) {
        throw new Error("Un ou plusieurs coureurs ont déjà été attribués dans cette phase.");
      }

      // Vérifier qu'il n'y a pas de doublons
      const uniqueCoureurIds = new Set(coureurIds);
      if (uniqueCoureurIds.size !== coureurIds.length) {
        throw new Error("Vous avez des doublons dans vos enchères.");
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
      queryClient.invalidateQueries({ queryKey: ['manager-phase-status'] });
      queryClient.invalidateQueries({ queryKey: ['current-round-drafts'] });
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

  // Roster complet check
  const rosterComplet = phaseStatus ? phaseStatus.slots_restants === 0 : false;
  
  // Validation conditions for submitting bids
  const hasExactSlots = phaseStatus && roundDrafts ? draftBids.length === phaseStatus.slots_restants : false;
  const budgetFullyUsed = phaseStatus && roundDrafts ? Math.abs(parseFloat(phaseStatus.budget_restant.toString()) - roundDrafts.draft_sum) < 1 : false;
  const canSubmitBids = hasExactSlots && budgetFullyUsed && draftBids.length > 0;
  const canAddMore = phaseStatus && roundDrafts ? roundDrafts.draft_count < phaseStatus.slots_restants : false;

  return (
    <div className="space-y-4">
      {/* Historique des enchères */}
      <BidHistory managerId={managerId} phaseId={auction.phase_id} />

      {/* Rosters des autres managers */}
      {Object.keys(rostersByManager).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Équipes des autres managers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(rostersByManager).map(([managerId, data]: [string, any]) => (
              <Collapsible key={managerId}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="font-medium">{data.managerName}</span>
                    <Badge variant="secondary">{data.rosters.length} coureur(s)</Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2 px-2">
                  {data.rosters.map((roster: any) => (
                    <div key={roster.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                      <div>
                        <p className="font-medium">{roster.coureurs.nom}</p>
                        <p className="text-muted-foreground text-xs">{roster.coureurs.equipe}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {parseFloat(roster.prix_signature.toString()).toFixed(0)} €
                      </Badge>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Show submitted bids if any */}
      {submittedBids.length > 0 && (
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
            <Alert className="mb-4">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Vos enchères ont été soumises et sont en attente de traitement.
              </AlertDescription>
            </Alert>
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
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Préparer mes enchères - Tour {auction.round_number}</span>
            <div className="flex items-center gap-2">
              {loadingBudget ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : phaseStatus ? (
                <>
                  <Badge variant="outline" className="text-sm">
                    Slots: {phaseStatus.slots_restants}
                  </Badge>
                  <Badge variant={parseFloat(phaseStatus.budget_restant.toString()) < 0 ? "destructive" : "secondary"} className="text-sm">
                    Budget: {parseFloat(phaseStatus.budget_restant.toString()).toFixed(0)} €
                  </Badge>
                </>
              ) : null}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Roster complet alert */}
          {rosterComplet && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                ✅ Roster complet pour cette phase ({phaseStatus?.roster_count}/{phaseStatus?.max_coureurs} coureurs)
              </AlertDescription>
            </Alert>
          )}

          {!rosterComplet && phaseStatus && (
            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertDescription>
                <div className="flex flex-col gap-1">
                  <div>Slots à saisir ce round : <strong>{phaseStatus.slots_restants}</strong></div>
                  <div>Budget restant : <strong>{parseFloat(phaseStatus.budget_restant.toString()).toFixed(0)} €</strong></div>
                  {roundDrafts && (
                    <div className="mt-2 text-sm">
                      <div className={roundDrafts.draft_count !== phaseStatus.slots_restants ? "text-orange-600" : "text-green-600"}>
                        Lignes : {roundDrafts.draft_count} / {phaseStatus.slots_restants}
                      </div>
                      <div className={Math.abs(parseFloat(phaseStatus.budget_restant.toString()) - roundDrafts.draft_sum) >= 1 ? "text-orange-600" : "text-green-600"}>
                        Somme : {roundDrafts.draft_sum.toFixed(0)} / {parseFloat(phaseStatus.budget_restant.toString()).toFixed(0)} €
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
          {/* List of draft bids */}
          {!rosterComplet && draftBids.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base">Enchères en préparation ({draftBids.length})</Label>
                {draftBids.length > 0 && (
                  <div className="flex flex-col items-end gap-2">
                    <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          className="gap-2"
                          disabled={!canSubmitBids}
                        >
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
                            Budget restant après validation: {phaseStatus ? parseFloat(phaseStatus.budget_restant.toString()).toFixed(0) : '0'} €
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
                    {!canSubmitBids && draftBids.length > 0 && phaseStatus && (
                      <div className="text-xs text-muted-foreground text-right">
                        {!hasExactSlots && (
                          <div className="text-orange-600">
                            ⚠️ Vous devez soumettre exactement {phaseStatus.slots_restants} enchère(s)
                          </div>
                        )}
                        {!budgetFullyUsed && roundDrafts && (
                          <div className="text-orange-600">
                            ⚠️ La somme doit être égale au budget restant ({parseFloat(phaseStatus.budget_restant.toString()).toFixed(0)} €, actuellement: {roundDrafts.draft_sum.toFixed(0)} €)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
          {!rosterComplet && (canAddMore || editingBidId) ? (
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
                              key={coureur.coureur_id}
                              value={`${coureur.coureur_nom} ${coureur.coureur_equipe || ''}`}
                              onSelect={() => {
                                if (!coureur.is_taken) {
                                  setSelectedCoureur(coureur);
                                  setOpen(false);
                                  setSearchTerm("");
                                }
                              }}
                              disabled={coureur.is_taken}
                              className={coureur.is_taken ? "opacity-60 cursor-not-allowed" : ""}
                            >
                              <div className="flex items-center justify-between w-full gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{coureur.coureur_nom}</p>
                                    {coureur.is_taken && (
                                      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                                        <Lock className="h-3 w-3" />
                                        Pris par {coureur.taken_by_manager_nom}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{coureur.coureur_equipe}</p>
                                </div>
                                {!coureur.is_taken && (
                                  <Badge variant="secondary">
                                    Min: {parseFloat(coureur.prix_initial.toString()).toFixed(0)} €
                                  </Badge>
                                )}
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
                      <span className="font-medium">{selectedCoureur.coureur_equipe}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cote minimum:</span>
                      <span className="font-medium flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {parseFloat(selectedCoureur.prix_initial.toString()).toFixed(0)} €
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

                  {phaseStatus && bidAmount && parseFloat(bidAmount) > parseFloat(phaseStatus.budget_restant.toString()) && (
                    <p className="text-sm text-destructive">
                      ⚠️ Budget insuffisant (reste: {parseFloat(phaseStatus.budget_restant.toString()).toFixed(0)} €)
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
          ) : !rosterComplet ? (
            <div className="text-center py-4 text-muted-foreground">
              Vous avez atteint le nombre maximum d'enchères pour ce round ({phaseStatus?.slots_restants || 0})
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Deadline: {new Date(auction.deadline_at).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
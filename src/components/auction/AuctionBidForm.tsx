import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

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

  const { data: coureurs } = useQuery({
    queryKey: ['coureurs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coureurs')
        .select('*')
        .order('nom');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: budget, isLoading: loadingBudget } = useQuery({
    queryKey: ['manager-budget', managerId, auction.phase_id],
    queryFn: async () => {
      // Get phase budget
      const { data: phase, error: phaseError } = await supabase
        .from('phases')
        .select('budget')
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

      const spent = rosters?.reduce((sum, r) => sum + parseFloat(r.prix_signature.toString()), 0) || 0;
      const remaining = parseFloat(phase.budget.toString()) - spent;

      return {
        total: parseFloat(phase.budget.toString()),
        spent,
        remaining
      };
    }
  });

  const { data: existingBid } = useQuery({
    queryKey: ['my-bid', auction.id, managerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('*, coureurs(nom, prix_initial, equipe)')
        .eq('auction_id', auction.id)
        .eq('manager_id', managerId)
        .eq('round_number', auction.round_number)
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (selectedCoureur && !bidAmount) {
      setBidAmount(selectedCoureur.prix_initial.toString());
    }
  }, [selectedCoureur]);

  const placeBid = useMutation({
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

      const { error } = await supabase
        .from('bids')
        .insert({
          auction_id: auction.id,
          manager_id: managerId,
          coureur_id: selectedCoureur.id,
          montant: amount,
          round_number: auction.round_number,
          statut: 'pending'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bid'] });
      toast({
        title: "Enchère placée",
        description: "Votre enchère a été enregistrée avec succès"
      });
      setSelectedCoureur(null);
      setBidAmount("");
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (existingBid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Votre enchère pour le tour {auction.round_number}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">{existingBid.coureurs.nom}</p>
                <p className="text-sm text-muted-foreground">{existingBid.coureurs.equipe}</p>
              </div>
              <Badge variant="outline" className="text-lg">
                {parseFloat(existingBid.montant.toString()).toFixed(0)} €
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Enchère en attente de validation
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Placer une enchère - Tour {auction.round_number}</span>
          {loadingBudget ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
              <Badge variant="outline" className="text-base">
              Budget: {budget?.remaining.toFixed(0) || '0'} €
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Coureur</Label>
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
              <Command>
                <CommandInput placeholder="Rechercher un coureur..." />
                <CommandList>
                  <CommandEmpty>Aucun coureur trouvé</CommandEmpty>
                  <CommandGroup>
                    {coureurs?.map((coureur) => (
                      <CommandItem
                        key={coureur.id}
                        value={coureur.nom}
                        onSelect={() => {
                          setSelectedCoureur(coureur);
                          setOpen(false);
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

            <Button
              onClick={() => placeBid.mutate()}
              disabled={placeBid.isPending || !selectedCoureur || !bidAmount}
              className="w-full"
            >
              {placeBid.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Valider l'enchère
            </Button>
          </>
        )}

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Deadline: {new Date(auction.deadline_at).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
};

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";

interface MatchRiderDialogProps {
  entry: any;
  saisonId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Fonction de normalisation pour comparer les noms
function normalize(s: string): string {
  if (!s) return '';
  return s.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export const MatchRiderDialog = ({ entry, saisonId, onClose, onSuccess }: MatchRiderDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(entry.source_name || '');
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [createAlias, setCreateAlias] = useState(true);

  const { data: riders, isLoading: searchLoading } = useQuery({
    queryKey: ['search-riders-for-match', searchQuery, saisonId],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];

      const { data, error } = await supabase
        .rpc('search_riders_for_matching', {
          p_saison_id: saisonId,
          p_query: searchQuery,
          p_limit: 20
        });

      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const handleMatch = async () => {
    if (!selectedRiderId) {
      toast({
        variant: "destructive",
        title: "Sélection requise",
        description: "Veuillez sélectionner un coureur",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Mettre à jour l'entrée startlist
      await supabase
        .from('startlist_entries')
        .update({
          coureur_id: selectedRiderId,
          status: 'confirmed',
        })
        .eq('id', entry.id);

      // Créer un alias si demandé et si le nom source est différent du nom du coureur
      if (createAlias) {
        const selectedRider = riders?.find((r: any) => r.coureur_id === selectedRiderId);
        const normalizedSourceName = normalize(entry.source_name);
        const normalizedRiderName = selectedRider ? normalize(selectedRider.coureur_nom) : '';
        
        // Ne créer l'alias que si les noms normalisés sont différents
        if (normalizedSourceName !== normalizedRiderName) {
          // Vérifier si l'alias existe déjà
          const { data: existingAlias } = await supabase
            .from('name_aliases')
            .select('id')
            .eq('alias_text', entry.source_name)
            .eq('coureur_id', selectedRiderId)
            .maybeSingle();
          
          if (!existingAlias) {
            await supabase.from('name_aliases').insert({
              coureur_id: selectedRiderId,
              alias_text: entry.source_name,
              source_team: entry.source_team || null,
            });
            
            toast({
              title: "Coureur matché",
              description: `Alias "${entry.source_name}" créé pour améliorer les imports futurs`,
            });
          } else {
            toast({
              title: "Coureur matché",
              description: "L'entrée a été associée avec succès",
            });
          }
        } else {
          toast({
            title: "Coureur matché",
            description: "L'entrée a été associée avec succès",
          });
        }
      } else {
        toast({
          title: "Coureur matché",
          description: "L'entrée a été associée avec succès (sans alias)",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Matcher avec un coureur existant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rechercher un coureur</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nom du coureur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {searchLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : riders && riders.length > 0 ? (
              <div className="divide-y">
                {riders.map((rider: any) => (
                  <button
                    key={rider.coureur_id}
                    className={`w-full text-left p-3 hover:bg-accent transition ${
                      selectedRiderId === rider.coureur_id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedRiderId(rider.coureur_id)}
                  >
                    <div className="font-medium">{rider.coureur_nom}</div>
                    <div className="text-sm text-muted-foreground">
                      {rider.equipe_nom || 'N/A'}
                    </div>
                  </button>
                ))}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div className="text-center py-4 text-muted-foreground">Aucun coureur trouvé</div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                Tapez au moins 2 caractères pour rechercher
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="createAlias" 
              checked={createAlias} 
              onCheckedChange={(checked) => setCreateAlias(checked === true)}
            />
            <Label htmlFor="createAlias" className="text-sm cursor-pointer">
              Créer un alias pour améliorer les imports futurs
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleMatch} disabled={isLoading || !selectedRiderId}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Matcher le coureur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UserPlus, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddRiderToStartlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startlistId: string;
  saisonId?: string;
  existingRiderIds: string[];
  onSuccess: () => void;
}

export const AddRiderToStartlistDialog = ({
  open,
  onOpenChange,
  startlistId,
  saisonId,
  existingRiderIds,
  onSuccess,
}: AddRiderToStartlistDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRider, setSelectedRider] = useState<{
    coureur_id: string;
    nom: string;
    equipe: string;
  } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Search riders from coureurs_saisons with season-specific team names
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["riders-search", saisonId, searchQuery],
    enabled: !!saisonId && searchQuery.length >= 2,
    queryFn: async () => {
      // Get riders with season-specific team names from equipes_saisons
      const { data, error } = await supabase
        .from("coureurs_saisons")
        .select(
          `
          coureur_id,
          equipe_id,
          coureurs!inner(nom)
        `
        )
        .eq("saison_id", saisonId)
        .eq("actif", true)
        .ilike("coureurs.nom", `%${searchQuery}%`)
        .limit(50);

      if (error) throw error;

      // Fetch team names from equipes_saisons
      const equipeIds = [...new Set((data || []).map((r: any) => r.equipe_id))];
      let equipesMap = new Map<string, string>();
      
      if (equipeIds.length > 0) {
        const { data: equipesData } = await supabase
          .from("equipes_saisons")
          .select("equipe_id, nom_affiche")
          .eq("saison_id", saisonId)
          .in("equipe_id", equipeIds);
        
        (equipesData || []).forEach((eq: any) => {
          equipesMap.set(eq.equipe_id, eq.nom_affiche);
        });
      }

      return (data || [])
        .map((r: any) => ({
          coureur_id: r.coureur_id,
          nom: r.coureurs.nom,
          equipe: equipesMap.get(r.equipe_id) || "N/A",
        }))
        .filter((r) => !existingRiderIds.includes(r.coureur_id));
    },
  });

  const handleAddRider = async () => {
    if (!selectedRider || !startlistId) return;

    setIsAdding(true);
    try {
      // Get the max line_no for this startlist
      const { data: maxLineData } = await supabase
        .from("startlist_entries")
        .select("line_no")
        .eq("startlist_id", startlistId)
        .order("line_no", { ascending: false })
        .limit(1)
        .single();

      const nextLineNo = (maxLineData?.line_no || 0) + 1;

      // Insert new entry
      const { error } = await supabase.from("startlist_entries").insert({
        startlist_id: startlistId,
        coureur_id: selectedRider.coureur_id,
        source_name: selectedRider.nom,
        source_team: selectedRider.equipe,
        line_no: nextLineNo,
        confidence: 1.0,
        status: "confirmed",
      });

      if (error) throw error;

      toast.success(`${selectedRider.nom} ajouté à la startlist`);
      setSelectedRider(null);
      setSearchQuery("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erreur lors de l'ajout: " + error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedRider(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un coureur</DialogTitle>
          <DialogDescription>
            Recherchez un coureur dans la base de données pour l'ajouter à la
            startlist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un coureur..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedRider(null);
              }}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Selected rider display */}
          {selectedRider && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="font-medium">{selectedRider.nom}</p>
              <p className="text-sm text-muted-foreground">
                {selectedRider.equipe}
              </p>
            </div>
          )}

          {/* Search results */}
          {!selectedRider && searchQuery.length >= 2 && (
            <ScrollArea className="h-[250px] border rounded-lg">
              {isSearching ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="p-1">
                  {searchResults.map((rider) => (
                    <button
                      key={rider.coureur_id}
                      className="w-full text-left px-3 py-2 rounded hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedRider(rider)}
                    >
                      <p className="font-medium text-sm">{rider.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {rider.equipe}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Aucun coureur trouvé
                </div>
              )}
            </ScrollArea>
          )}

          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <p className="text-sm text-muted-foreground text-center">
              Entrez au moins 2 caractères pour rechercher
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleAddRider}
            disabled={!selectedRider || isAdding}
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

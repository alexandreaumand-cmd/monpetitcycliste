import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";

export type SkippedInjury = {
  name: string;
  slug: string | null;
  injury: string;
  injury_date: string;
  weeks_out: number;
  reason: string;
};

interface Props {
  skipped: SkippedInjury;
  saisonId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

// "ABRAHAMSEN Jonas" -> "Jonas ABRAHAMSEN"
function reformatPcsName(name: string): string {
  const tokens = name.trim().split(/\s+/);
  const upper: string[] = [];
  const rest: string[] = [];
  for (const t of tokens) {
    if (t === t.toUpperCase() && /[A-Z]/.test(t)) upper.push(t);
    else rest.push(t);
  }
  if (upper.length && rest.length) return [...rest, ...upper].join(" ");
  return name;
}

export const MatchSkippedInjuryDialog = ({ skipped, saisonId, onClose, onSuccess }: Props) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(reformatPcsName(skipped.name));
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);

  const { data: riders, isLoading: searchLoading } = useQuery({
    queryKey: ["search-riders-injury-match", searchQuery, saisonId],
    queryFn: async () => {
      if (!saisonId || searchQuery.length < 2) return [];
      const { data, error } = await supabase.rpc("search_riders_for_matching", {
        p_saison_id: saisonId,
        p_query: searchQuery,
        p_limit: 20,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!saisonId && searchQuery.length >= 2,
  });

  const handleMatch = async () => {
    if (!selectedRiderId) {
      toast({ variant: "destructive", title: "Sélection requise", description: "Choisissez un coureur" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.from("rider_injuries").upsert(
        {
          coureur_id: selectedRiderId,
          rider_name_pcs: skipped.name,
          injury: skipped.injury,
          injury_date: skipped.injury_date,
          weeks_out: skipped.weeks_out,
          source_url: "https://www.procyclingstats.com/statistics/latest-injuries.php",
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "coureur_id,injury_date,injury" },
      );
      if (error) throw error;
      toast({ title: "Blessure associée", description: "La blessure a été ajoutée au coureur." });
      onSuccess();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Matcher « {skipped.name} » avec un coureur</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm bg-muted/30">
            <div><span className="text-muted-foreground">Blessure :</span> {skipped.injury}</div>
            <div><span className="text-muted-foreground">Date :</span> {skipped.injury_date}</div>
            <div><span className="text-muted-foreground">Semaines :</span> {skipped.weeks_out}</div>
          </div>

          <div className="space-y-2">
            <Label>Rechercher un coureur</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nom du coureur…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {!saisonId ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Aucune saison sélectionnée.
              </div>
            ) : searchLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : riders && riders.length > 0 ? (
              <div className="divide-y">
                {riders.map((rider: { coureur_id: string; coureur_nom: string; equipe_nom: string | null }) => (
                  <button
                    key={rider.coureur_id}
                    className={`w-full text-left p-3 hover:bg-accent transition ${
                      selectedRiderId === rider.coureur_id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedRiderId(rider.coureur_id)}
                  >
                    <div className="font-medium">{rider.coureur_nom}</div>
                    <div className="text-sm text-muted-foreground">{rider.equipe_nom || "N/A"}</div>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleMatch} disabled={isLoading || !selectedRiderId}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmer le match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

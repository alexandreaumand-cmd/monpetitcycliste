import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const SeasonDeleteManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSaison, setSelectedSaison] = useState<string>("");
  const [deleteSaisonItself, setDeleteSaisonItself] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");

  const { data: saisons } = useQuery({
    queryKey: ['saisons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const selectedSaisonData = saisons?.find(s => s.id === selectedSaison);
  const expectedPhrase = selectedSaisonData ? `DELETE SEASON ${selectedSaisonData.annee}` : "";
  const isConfirmationValid = confirmationPhrase === expectedPhrase;

  const deleteSeason = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-delete-season', {
        body: {
          saison_id: selectedSaison,
          confirmation_phrase: confirmationPhrase,
          delete_season_itself: deleteSaisonItself
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saisons'] });
      queryClient.invalidateQueries({ queryKey: ['phases'] });
      
      // Construire le message de succès avec le détail des suppressions
      const deletedItems = Object.entries(data.deleted as Record<string, number>)
        .filter(([_, count]) => count > 0)
        .map(([key, count]) => `${count} ${key}`)
        .join(', ');

      toast({
        title: "✅ Saison supprimée",
        description: `Saison ${data.saison_annee} nettoyée avec succès. Supprimé: ${deletedItems}`,
        duration: 10000
      });

      // Reset form
      setSelectedSaison("");
      setDeleteSaisonItself(false);
      setConfirmationPhrase("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <Card className="border-destructive">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">🗑️ Zone dangereuse</CardTitle>
        </div>
        <CardDescription>
          Suppression irréversible de toutes les données d'une saison
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>⚠️ Action irréversible</AlertTitle>
          <AlertDescription>
            Cette action supprimera TOUTES les données liées à la saison sélectionnée :
            phases, courses, résultats, enchères, rosters, bonus, startlists, etc.
            Cette action ne peut pas être annulée.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="saison-select">Saison à supprimer</Label>
            <Select value={selectedSaison} onValueChange={setSelectedSaison}>
              <SelectTrigger id="saison-select">
                <SelectValue placeholder="Sélectionner une saison" />
              </SelectTrigger>
              <SelectContent>
                {saisons?.map((saison) => (
                  <SelectItem key={saison.id} value={saison.id}>
                    Saison {saison.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSaison && (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delete-saison-itself"
                  checked={deleteSaisonItself}
                  onCheckedChange={(checked) => setDeleteSaisonItself(checked as boolean)}
                />
                <Label
                  htmlFor="delete-saison-itself"
                  className="text-sm font-normal cursor-pointer"
                >
                  Supprimer aussi la saison elle-même (pas seulement les données)
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation">
                  Confirmation (tapez exactement : <code className="bg-muted px-2 py-1 rounded text-destructive font-mono">{expectedPhrase}</code>)
                </Label>
                <Input
                  id="confirmation"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  placeholder={expectedPhrase}
                  className={isConfirmationValid ? "border-green-500" : ""}
                />
              </div>

              <Button
                variant="destructive"
                onClick={() => deleteSeason.mutate()}
                disabled={!isConfirmationValid || deleteSeason.isPending}
                className="w-full"
                size="lg"
              >
                {deleteSeason.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer définitivement la saison {selectedSaisonData?.annee}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

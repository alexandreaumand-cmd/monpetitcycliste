import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { toast } from "sonner";

interface UnmatchedEntry {
  entry_id: string;
  raw_name: string;
  line_no: number;
  bib_no: string | null;
  suggestions: Array<{
    coureur_id: string;
    nom: string;
    equipe: string;
    similarity: number;
  }>;
}

interface ReviewUnmatchedProps {
  startlistId: string;
  onBack: () => void;
  onComplete: () => void;
}

export const StartlistReviewUnmatched = ({ startlistId, onBack, onComplete }: ReviewUnmatchedProps) => {
  const queryClient = useQueryClient();
  const [selectedMatches, setSelectedMatches] = useState<Record<string, { coureur_id: string; create_alias: boolean }>>({});
  const [isConfirming, setIsConfirming] = useState(false);

  // Fetch unmatched entries with suggestions
  const { data: reviewData, isLoading } = useQuery({
    queryKey: ['startlist-review-unmatched', startlistId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('startlist-review-unmatched', {
        body: { startlist_id: startlistId }
      });

      if (error) throw error;
      return data as {
        confirmed: UnmatchedEntry[];
        off_roster: UnmatchedEntry[];
        unmatched: UnmatchedEntry[];
      };
    },
  });

  const handleSelectSuggestion = (entryId: string, coureurId: string) => {
    setSelectedMatches(prev => ({
      ...prev,
      [entryId]: { coureur_id: coureurId, create_alias: true }
    }));
  };

  const handleToggleAlias = (entryId: string) => {
    setSelectedMatches(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        create_alias: !prev[entryId]?.create_alias
      }
    }));
  };

  const handleConfirmMatches = async () => {
    const items = Object.entries(selectedMatches).map(([entry_id, { coureur_id }]) => ({
      entry_id,
      coureur_id
    }));

    if (items.length === 0) {
      toast.error("Aucune correspondance sélectionnée");
      return;
    }

    // Vérifier si au moins un alias est coché
    const createAliases = Object.values(selectedMatches).some(m => m.create_alias);

    setIsConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke('startlist-confirm-matches', {
        body: {
          items,
          create_alias: createAliases
        }
      });

      if (error) throw error;

      toast.success(`${data.confirmed} correspondances confirmées, ${data.aliases_created} alias créés`);
      queryClient.invalidateQueries({ queryKey: ['startlist-review-unmatched', startlistId] });
      queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
      
      setSelectedMatches({});
      
      // Si tout est traité, retourner
      if (reviewData && reviewData.unmatched.length === items.length) {
        onComplete();
      }
    } catch (error: any) {
      console.error('Confirmation error:', error);
      toast.error("Erreur : " + (error.message || "Erreur inconnue"));
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { confirmed = [], off_roster = [], unmatched = [] } = reviewData || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Révision des correspondances</h2>
          <p className="text-muted-foreground mt-1">
            Confirmez les suggestions de matching pour les coureurs non identifiés
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          ← Retour
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Confirmés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmed.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Hors roster
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{off_roster.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              À traiter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unmatched.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Coureurs à traiter */}
      {unmatched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Coureurs à traiter ({unmatched.length})</CardTitle>
            <CardDescription>
              Sélectionnez la bonne correspondance pour chaque coureur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {unmatched.map((entry) => (
              <div key={entry.entry_id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{entry.raw_name}</div>
                    <div className="text-sm text-muted-foreground">
                      Ligne {entry.line_no}
                      {entry.bib_no && ` • Dossard ${entry.bib_no}`}
                    </div>
                  </div>
                </div>

                {entry.suggestions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Suggestions :</div>
                    {entry.suggestions.map((suggestion) => (
                      <div
                        key={suggestion.coureur_id}
                        className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                          selectedMatches[entry.entry_id]?.coureur_id === suggestion.coureur_id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => handleSelectSuggestion(entry.entry_id, suggestion.coureur_id)}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{suggestion.nom}</div>
                          <div className="text-sm text-muted-foreground">{suggestion.equipe}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">
                            {Math.round(suggestion.similarity * 100)}% similaire
                          </Badge>
                          {selectedMatches[entry.entry_id]?.coureur_id === suggestion.coureur_id && (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedMatches[entry.entry_id]?.create_alias ?? true}
                                onCheckedChange={() => handleToggleAlias(entry.entry_id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm">Créer alias</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    Aucune suggestion trouvée
                  </div>
                )}
              </div>
            ))}

            {Object.keys(selectedMatches).length > 0 && (
              <Button
                onClick={handleConfirmMatches}
                disabled={isConfirming}
                className="w-full"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Confirmation en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmer {Object.keys(selectedMatches).length} correspondance(s)
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Coureurs confirmés */}
      {confirmed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Coureurs confirmés ({confirmed.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Ces coureurs ont été automatiquement matchés avec le roster
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coureurs hors roster */}
      {off_roster.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Coureurs hors roster ({off_roster.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Ces coureurs ont été identifiés via alias mais ne sont pas dans le roster de cette phase
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

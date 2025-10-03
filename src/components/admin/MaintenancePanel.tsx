import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Trash2, Eye, RefreshCw, Calendar } from "lucide-react";

export const MaintenancePanel = () => {
  const [confirmInput, setConfirmInput] = useState("");
  const [cleanConfirmInput, setCleanConfirmInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const CONFIRM_PHRASE = "RESET TOUS RESULTATS";

  // Preview query (manual trigger)
  const { data: preview, refetch: fetchPreview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['admin-results-preview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_results_reset_preview');
      if (error) throw error;
      return data as { race_results_count: number; points_ledger_count: number };
    },
    enabled: false
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async (confirmPhrase: string) => {
      const { data, error } = await supabase.rpc('admin_results_reset_all', {
        p_confirm_phrase: confirmPhrase
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Résultats purgés",
        description: "Toutes les saisies de résultats et tous les points ont été supprimés.",
      });
      setConfirmInput('');
      fetchPreview();
      queryClient.invalidateQueries({ queryKey: ['race-results'] });
      queryClient.invalidateQueries({ queryKey: ['points'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update race phases mutation
  const updatePhasesMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('update-race-phases');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Phases mises à jour",
        description: `${data.coursesUpdated} courses ont été réassignées aux bonnes phases.`,
      });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Clean courses and phases mutation
  const cleanMutation = useMutation({
    mutationFn: async (confirmPhrase: string) => {
      const { data, error } = await supabase.rpc('admin_clean_courses_phases', {
        p_confirm_phrase: confirmPhrase
      });
      if (error) throw error;
      return data as { success: boolean; deleted_courses: number; deleted_phases: number };
    },
    onSuccess: (data) => {
      toast({
        title: "Nettoyage effectué",
        description: `${data.deleted_courses} courses et ${data.deleted_phases} phases supprimées.`,
      });
      setCleanConfirmInput("");
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['phases'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleReset = () => {
    resetMutation.mutate(confirmInput);
  };

  const handleClean = () => {
    cleanMutation.mutate(cleanConfirmInput);
  };

  const isConfirmValid = confirmInput === CONFIRM_PHRASE;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold">Maintenance - Réinitialisation</h2>
        <p className="text-muted-foreground mt-2">
          Outils de maintenance pour les administrateurs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mise à jour des phases des courses
          </CardTitle>
          <CardDescription>
            Réassigner les courses à leurs phases correctes selon le calendrier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cette opération met à jour le <code className="bg-muted px-2 py-1 rounded">phase_id</code> de chaque course
            selon le mapping défini dans le fichier CSV de référence. Les courses seront réparties entre les 4 phases de la saison.
          </p>
          <Button
            onClick={() => updatePhasesMutation.mutate()}
            disabled={updatePhasesMutation.isPending}
            variant="default"
          >
            {updatePhasesMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Mise à jour en cours...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                Mettre à jour les phases
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-orange-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <Trash2 className="h-5 w-5" />
            Nettoyer Courses et Phases
          </CardTitle>
          <CardDescription>
            Supprime toutes les courses et phases pour permettre une réimportation complète
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-orange-500">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Attention:</strong> Cette opération supprimera toutes les courses et phases. 
              Les rosters et auctions existants deviendront orphelins. 
              Opération irréversible.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="clean-confirm">
              Tapez <code className="bg-muted px-2 py-1 rounded">NETTOYER COURSES PHASES</code> pour confirmer
            </Label>
            <Input
              id="clean-confirm"
              value={cleanConfirmInput}
              onChange={(e) => setCleanConfirmInput(e.target.value)}
              placeholder="NETTOYER COURSES PHASES"
              disabled={cleanMutation.isPending}
            />
          </div>

          <Button
            onClick={handleClean}
            disabled={cleanConfirmInput !== "NETTOYER COURSES PHASES" || cleanMutation.isPending}
            variant="destructive"
            className="w-full"
          >
            {cleanMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Nettoyage en cours...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Nettoyer Courses et Phases
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Alert variant="destructive" className="border-2">
        <AlertTriangle className="h-5 w-5" />
        <AlertDescription className="ml-2">
          <strong>⚠️ ATTENTION - ACTION IRRÉVERSIBLE</strong>
          <br />
          Cette opération supprime <strong>TOUTES</strong> les saisies de résultats et <strong>TOUS</strong> les points calculés.
          <br />
          Les données ne pourront pas être récupérées.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Aperçu de l'impact
          </CardTitle>
          <CardDescription>
            Vérifiez combien de données seront supprimées
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => fetchPreview()}
            disabled={isLoadingPreview}
            variant="outline"
          >
            {isLoadingPreview ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Chargement...
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Voir l'impact
              </>
            )}
          </Button>

          {preview && (
            <div className="flex flex-wrap gap-3 mt-4">
              <Badge variant="destructive" className="text-base px-4 py-2">
                <Trash2 className="mr-2 h-4 w-4" />
                {preview.race_results_count} résultats à supprimer
              </Badge>
              <Badge variant="destructive" className="text-base px-4 py-2">
                <Trash2 className="mr-2 h-4 w-4" />
                {preview.points_ledger_count} points à supprimer
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Réinitialisation complète
          </CardTitle>
          <CardDescription>
            Suppression de toutes les données de résultats et points
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-input">
              Pour confirmer, tapez : <code className="bg-muted px-2 py-1 rounded">{CONFIRM_PHRASE}</code>
            </Label>
            <Input
              id="confirm-input"
              type="text"
              placeholder={CONFIRM_PHRASE}
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="font-mono"
            />
          </div>

          <Button
            onClick={handleReset}
            disabled={!isConfirmValid || resetMutation.isPending}
            variant="destructive"
            className="w-full"
          >
            {resetMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Suppression en cours...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Réinitialiser maintenant
              </>
            )}
          </Button>

          {resetMutation.isSuccess && (
            <Alert className="border-green-600 bg-green-50">
              <AlertDescription>
                ✅ Opération terminée. Vous pouvez ré-importer les résultats depuis l'onglet{" "}
                <a href="/dashboard/admin/data" className="underline font-semibold">
                  Import de données
                </a>.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

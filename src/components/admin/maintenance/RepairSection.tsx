import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wrench, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export const RepairSection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<any>(null);

  // Get active phase
  const { data: activePhase } = useQuery({
    queryKey: ['active-phase'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('id, index_dans_saison')
        .eq('statut', 'active')
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const fixPorteurMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('auto-fix-missing-porteur-points');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast({
        title: "Réparation terminée",
        description: `${data.courses_processed} courses traitées, ${data.total_points_added} points ajoutés.`,
      });
      queryClient.invalidateQueries({ queryKey: ['missing-porteur-points'] });
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

  const recomputePhaseMutation = useMutation({
    mutationFn: async () => {
      if (!activePhase?.id) throw new Error("Aucune phase active");
      
      const { data, error } = await supabase.functions.invoke('compute-points', {
        body: { phase_id: activePhase.id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Recalcul terminé",
        description: `${data.courses_processed} courses recalculées.`,
      });
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Auto-réparation points Porteur
          </CardTitle>
          <CardDescription>
            Détecte et corrige automatiquement les points Porteur manquants
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Cette opération analyse tous les résultats "Porteur" et ajoute les points manquants
              dans la table points_ledger. Elle est <strong>sûre</strong> et peut être exécutée plusieurs fois.
            </AlertDescription>
          </Alert>

          <Button
            onClick={() => fixPorteurMutation.mutate()}
            disabled={fixPorteurMutation.isPending}
            className="w-full"
          >
            {fixPorteurMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Réparation en cours...
              </>
            ) : (
              <>
                <Wrench className="mr-2 h-4 w-4" />
                Réparer points Porteur
              </>
            )}
          </Button>

          {lastResult && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="default">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {lastResult.courses_processed} courses traitées
              </Badge>
              <Badge variant="default">
                {lastResult.total_points_added} points ajoutés
              </Badge>
              <Badge variant={lastResult.errors_count > 0 ? "destructive" : "secondary"}>
                {lastResult.errors_count} erreurs
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Recalculer points phase active
          </CardTitle>
          <CardDescription>
            Recalcule tous les points de la phase actuellement active
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activePhase && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cette opération recalculera tous les points de la <strong>Phase {activePhase.index_dans_saison}</strong>.
                Utiliser après correction de barèmes ou import de nouvelles courses.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={() => recomputePhaseMutation.mutate()}
            disabled={recomputePhaseMutation.isPending || !activePhase}
            className="w-full"
          >
            {recomputePhaseMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Recalcul en cours...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recalculer phase active
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </>
  );
};

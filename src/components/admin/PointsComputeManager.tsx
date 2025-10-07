import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calculator, AlertCircle, Wrench } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const PointsComputeManager = () => {
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [computing, setComputing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [fixResult, setFixResult] = useState<any>(null);
  const { toast } = useToast();

  const { data: phases } = useQuery({
    queryKey: ['phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .order('date_debut', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const handleCompute = async () => {
    if (!selectedPhase) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une phase",
        variant: "destructive"
      });
      return;
    }

    // Confirmation dialog
    const confirmed = window.confirm(
      "⚠️ ATTENTION : Cette action va recalculer TOUS les points pour cette phase.\n\n" +
      "Cela va :\n" +
      "• Recalculer les points de toutes les courses de la phase\n" +
      "• Mettre à jour tous les totaux managers\n" +
      "• Peut prendre plusieurs secondes\n\n" +
      "Êtes-vous sûr de vouloir continuer ?"
    );

    if (!confirmed) return;

    setComputing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('compute-points', {
        body: { phase_id: selectedPhase }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "✅ Calcul terminé avec succès",
        description: `${data.courses_processed} courses traitées → ${data.total_rows} points calculés pour tous les managers`
      });
    } catch (error: any) {
      console.error('Error computing points:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de calculer les points",
        variant: "destructive"
      });
    } finally {
      setComputing(false);
    }
  };

  const handleFixPorteurPoints = async () => {
    setFixing(true);
    setFixResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('auto-fix-missing-porteur-points');

      if (error) throw error;

      setFixResult(data);
      toast({
        title: "✅ Réparation terminée",
        description: `${data.courses_processed} courses traitées, ${data.total_points_added} points ajoutés`
      });
    } catch (error: any) {
      console.error('Error fixing porteur points:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de réparer les points porteurs",
        variant: "destructive"
      });
    } finally {
      setFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Recalcul des points
        </CardTitle>
        <CardDescription>
          ⚠️ Recalcule TOUS les points pour une phase complète (toutes les courses). Cette action reconstruit complètement le ledger de points.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Sélectionner une phase" />
            </SelectTrigger>
            <SelectContent>
              {phases?.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  Phase {phase.index_dans_saison} - {phase.statut}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={handleCompute}
            disabled={computing || !selectedPhase}
          >
            {computing ? "Calcul en cours..." : "Recalculer"}
          </Button>
        </div>

        {result && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Résultat :</strong>
              <br />
              • {result.courses_processed} courses traitées
              <br />
              • {result.total_rows} lignes de points créées/mises à jour
              {result.missing_bareme && result.missing_bareme.length > 0 && (
                <>
                  <br />
                  <br />
                  <strong className="text-destructive">⚠️ Barèmes manquants :</strong>
                  <pre className="mt-2 text-xs">
                    {JSON.stringify(result.missing_bareme, null, 2)}
                  </pre>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Separator className="my-6" />

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Réparation automatique</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Détecte et corrige automatiquement les points manquants pour les porteurs de maillots
            </p>
          </div>

          <Button 
            onClick={handleFixPorteurPoints}
            disabled={fixing}
            variant="outline"
            className="w-full"
          >
            <Wrench className="h-4 w-4 mr-2" />
            {fixing ? "Réparation en cours..." : "Réparer les points porteurs"}
          </Button>

          {fixResult && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Résultat de la réparation :</strong>
                <br />
                • {fixResult.courses_processed} courses traitées
                <br />
                • {fixResult.total_points_added} points ajoutés
                <br />
                • {fixResult.successful} succès / {fixResult.failed} échecs
                {fixResult.results && fixResult.results.length > 0 && (
                  <>
                    <br />
                    <br />
                    <strong>Détails :</strong>
                    <div className="mt-2 space-y-1 text-xs">
                      {fixResult.results.map((r: any, i: number) => (
                        <div key={i} className={r.success ? "text-green-600" : "text-destructive"}>
                          {r.success ? "✓" : "✗"} {r.course_nom} ({r.course_id})
                          {r.rows_upserted && ` - ${r.rows_upserted} points ajoutés`}
                          {r.error && ` - Erreur: ${r.error}`}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

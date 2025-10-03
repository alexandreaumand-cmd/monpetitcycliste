import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calculator, AlertCircle } from "lucide-react";

export const PointsComputeManager = () => {
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<any>(null);
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

    setComputing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('compute-points', {
        body: { phase_id: selectedPhase }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "✅ Calcul terminé",
        description: `${data.courses_processed} courses traitées, ${data.total_rows} points calculés`
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Recalcul des points
        </CardTitle>
        <CardDescription>
          Recalculer tous les points pour une phase complète (toutes les courses)
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
      </CardContent>
    </Card>
  );
};

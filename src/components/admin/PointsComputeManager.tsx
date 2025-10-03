import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Calculator, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const PointsComputeManager = () => {
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [computing, setComputing] = useState(false);

  const { data: phases } = useQuery({
    queryKey: ["phases-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phases")
        .select("id, index_dans_saison")
        .order("index_dans_saison", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleComputePhase = async () => {
    if (!selectedPhase) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une phase",
        variant: "destructive",
      });
      return;
    }

    setComputing(true);

    try {
      const { data, error } = await supabase.functions.invoke('compute-points', {
        body: { phase_id: selectedPhase }
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        courses_processed: number;
        total_rows: number;
      };

      toast({
        title: "Calcul réussi",
        description: `${result.courses_processed} courses traitées, ${result.total_rows} entrées créées/mises à jour`,
      });
    } catch (error) {
      console.error('Error computing points:', error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du calcul des points",
        variant: "destructive",
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
          Calcul des Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Le calcul des points utilise les barèmes (scoring_rules) et attribue les points aux managers 
            selon les rosters de la phase de la course.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm font-medium">Sélectionner une phase</label>
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une phase" />
            </SelectTrigger>
            <SelectContent>
              {phases?.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  Phase {phase.index_dans_saison}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleComputePhase}
          disabled={computing || !selectedPhase}
          className="w-full"
        >
          {computing ? "Calcul en cours..." : "Recalculer tous les points de la phase"}
        </Button>
      </CardContent>
    </Card>
  );
};

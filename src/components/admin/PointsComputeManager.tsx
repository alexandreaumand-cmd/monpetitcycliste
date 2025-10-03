import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const PointsComputeManager = () => {
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [isComputing, setIsComputing] = useState(false);
  const { toast } = useToast();

  const { data: phases } = useQuery({
    queryKey: ["phases-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phases")
        .select("id, index_dans_saison, date_debut, date_fin, statut")
        .order("date_debut", { ascending: false });
      
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

    setIsComputing(true);
    try {
      const { data, error } = await supabase.functions.invoke('compute-points', {
        body: { phase_id: selectedPhase }
      });

      if (error) throw error;

      toast({
        title: "✓ Calcul terminé",
        description: `${data.courses_processed} courses traitées, ${data.total_rows} lignes de points créées`,
      });
    } catch (error: any) {
      console.error('Error computing points:', error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du calcul des points",
        variant: "destructive",
      });
    } finally {
      setIsComputing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Calcul des Points
        </CardTitle>
        <CardDescription>
          Recalculer tous les points d'une phase à partir des résultats et barèmes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>Le calcul utilise strictement scoring_rules et la phase de la course</span>
        </div>

        <div className="flex gap-2">
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Sélectionner une phase" />
            </SelectTrigger>
            <SelectContent>
              {phases?.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  Phase {phase.index_dans_saison} ({phase.statut})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleComputePhase}
            disabled={!selectedPhase || isComputing}
          >
            {isComputing ? "Calcul..." : "Recalculer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

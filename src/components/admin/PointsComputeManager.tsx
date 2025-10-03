import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Loader2 } from "lucide-react";

export const PointsComputeManager = () => {
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [isComputing, setIsComputing] = useState(false);
  const { toast } = useToast();

  const { data: phases } = useQuery({
    queryKey: ["phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phases")
        .select("*")
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
        title: "✅ Points recalculés",
        description: `${data.courses_processed} courses traitées, ${data.total_rows} entrées de points créées`,
      });
    } catch (error) {
      console.error('Error computing points:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors du calcul des points",
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
          Recalculer les Points
        </CardTitle>
        <CardDescription>
          Recalculer les points pour toutes les courses d'une phase à partir des résultats et barèmes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Phase</label>
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une phase" />
            </SelectTrigger>
            <SelectContent>
              {phases?.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  Phase {phase.index_dans_saison} ({phase.date_debut} → {phase.date_fin})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleComputePhase}
          disabled={isComputing || !selectedPhase}
          className="w-full"
        >
          {isComputing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calcul en cours...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-4 w-4" />
              Recalculer les points
            </>
          )}
        </Button>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>ℹ️ Cette opération va :</p>
          <ul className="list-disc list-inside pl-2 space-y-1">
            <li>Supprimer les points existants de la phase</li>
            <li>Recalculer tous les points à partir des résultats</li>
            <li>Associer les points aux managers selon les rosters</li>
            <li>Utiliser les barèmes (scoring_rules) pour calculer</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

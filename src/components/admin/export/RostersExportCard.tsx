import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Users2 } from "lucide-react";

export const RostersExportCard = () => {
  const [exporting, setExporting] = useState(false);
  const [phaseId, setPhaseId] = useState<string>("all");
  const { toast } = useToast();

  const { data: phases } = useQuery({
    queryKey: ['phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('*, saisons(annee)')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleExport = async () => {
    setExporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('export-rosters-csv', {
        body: phaseId === "all" ? {} : { phase_id: phaseId },
      });

      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'rosters_export.csv';
      link.click();
      URL.revokeObjectURL(link.href);

      toast({
        title: "✅ Export réussi",
        description: "Le fichier rosters_export.csv a été téléchargé",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Erreur d'export",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users2 className="h-5 w-5" />
          Rosters
        </CardTitle>
        <CardDescription>
          Exporter les rosters (équipes) d'une phase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Phase</Label>
          <Select value={phaseId} onValueChange={setPhaseId}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les phases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les phases</SelectItem>
              {phases?.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  Phase {phase.index_dans_saison} - {phase.saisons?.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleExport} disabled={exporting} className="w-full">
          {exporting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Export...</>
          ) : (
            <><Download className="mr-2 h-4 w-4" /> Exporter CSV</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

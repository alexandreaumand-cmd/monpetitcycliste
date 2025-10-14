import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Users } from "lucide-react";

export const CoureursExportCard = () => {
  const [exporting, setExporting] = useState(false);
  const [selectedSaison, setSelectedSaison] = useState<string>("");
  const { toast } = useToast();

  // Fetch saisons
  const { data: saisons } = useQuery({
    queryKey: ['saisons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('*')
        .order('annee', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleExport = async () => {
    if (!selectedSaison) {
      toast({
        title: "Sélection requise",
        description: "Veuillez sélectionner une saison",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('export-coureurs-csv', {
        body: { saison_id: selectedSaison }
      });

      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const saisonAnnee = saisons?.find(s => s.id === selectedSaison)?.annee || 'export';
      link.download = `coureurs_${saisonAnnee}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast({
        title: "✅ Export réussi",
        description: `Le fichier coureurs_${saisonAnnee}.csv a été téléchargé`,
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
          <Users className="h-5 w-5" />
          Coureurs
        </CardTitle>
        <CardDescription>
          Exporter les coureurs d'une saison spécifique
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedSaison} onValueChange={setSelectedSaison}>
          <SelectTrigger>
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
        <Button onClick={handleExport} disabled={exporting || !selectedSaison} className="w-full">
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

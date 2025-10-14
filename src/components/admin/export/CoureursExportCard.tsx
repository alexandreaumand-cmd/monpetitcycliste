import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Users } from "lucide-react";

export const CoureursExportCard = () => {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('export-coureurs-csv');

      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'coureurs_export.csv';
      link.click();
      URL.revokeObjectURL(link.href);

      toast({
        title: "✅ Export réussi",
        description: "Le fichier coureurs_export.csv a été téléchargé",
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
          Exporter tous les coureurs de la base de données
        </CardDescription>
      </CardHeader>
      <CardContent>
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

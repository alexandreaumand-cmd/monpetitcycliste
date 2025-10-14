import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, BarChart } from "lucide-react";

export const BaremesExportCard = () => {
  const [exporting, setExporting] = useState(false);
  const [saisonId, setSaisonId] = useState<string>("all");
  const { toast } = useToast();

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
    setExporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('export-baremes-csv', {
        body: saisonId === "all" ? {} : { saison_id: saisonId },
      });

      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'baremes_export.csv';
      link.click();
      URL.revokeObjectURL(link.href);

      toast({
        title: "✅ Export réussi",
        description: "Le fichier baremes_export.csv a été téléchargé",
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
          <BarChart className="h-5 w-5" />
          Barèmes
        </CardTitle>
        <CardDescription>
          Exporter les barèmes de points d'une saison
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Saison</Label>
          <Select value={saisonId} onValueChange={setSaisonId}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les saisons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les saisons</SelectItem>
              {saisons?.map((saison) => (
                <SelectItem key={saison.id} value={saison.id}>
                  Saison {saison.annee}
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

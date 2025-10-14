import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2, Info, Users2 } from "lucide-react";
import { generateRostersTemplate, downloadCSV } from "@/lib/exportTemplates";

export const RostersImportSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleDownloadTemplate = () => {
    downloadCSV(generateRostersTemplate(), 'template_rosters.csv');
    toast({
      title: "✅ Template téléchargé",
      description: "Le fichier template_rosters.csv a été téléchargé",
    });
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier CSV",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const csvData = await file.text();
      
      const { data, error } = await supabase.functions.invoke('import-data', {
        body: {
          table: 'rosters',
          data: csvData,
        },
      });

      if (error) throw error;

      toast({
        title: "✅ Import réussi",
        description: `${data.imported || 0} rosters importés`,
      });

      setFile(null);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.value = '';
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erreur d'import",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AccordionItem value="rosters">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <Users2 className="h-4 w-4" />
          <span>Rosters</span>
          <Badge variant="secondary">~150 lignes</Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="space-y-4 pt-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Format attendu</AlertTitle>
          <AlertDescription>
            <code className="text-xs block mb-2 bg-muted p-2 rounded">
              Coureur;Propriétaire;Phase;Prix
            </code>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li><strong>Coureur</strong> : Nom du coureur (doit exister dans la table coureurs)</li>
              <li><strong>Propriétaire</strong> : Nom du manager</li>
              <li><strong>Phase</strong> : "Phase 1", "Phase 2" ou UUID exact</li>
              <li><strong>Prix</strong> : Prix de signature</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Button 
          onClick={handleDownloadTemplate} 
          variant="outline" 
          className="w-full"
        >
          <Download className="mr-2 h-4 w-4" />
          Télécharger un template avec exemples
        </Button>

        <div className="space-y-2">
          <Label>Fichier CSV</Label>
          <Input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <Button 
          onClick={handleImport} 
          disabled={!file || importing}
          className="w-full"
        >
          {importing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Import en cours...</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Importer</>
          )}
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
};

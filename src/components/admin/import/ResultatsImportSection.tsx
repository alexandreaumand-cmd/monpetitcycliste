import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2, Info, Trophy, AlertCircle } from "lucide-react";
import { generateResultatsTemplate, downloadCSV } from "@/lib/exportTemplates";

export const ResultatsImportSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();


  const handleDownloadTemplate = () => {
    downloadCSV(generateResultatsTemplate(), 'template_resultats.csv');
    toast({
      title: "✅ Template téléchargé",
      description: "Le fichier template_resultats.csv a été téléchargé",
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
      
      const { data, error } = await supabase.functions.invoke('admin-import-race-results-csv', {
        body: { csv_content: csvData },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Import échoué');
      }

      toast({
        title: "✅ Import réussi",
        description: `${data.imported || 0} résultats importés, ${data.courses_affected?.length || 0} course(s) recalculée(s)`,
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
    <AccordionItem value="resultats">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          <span>Résultats</span>
          <Badge variant="secondary">~1000 lignes</Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="space-y-4 pt-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Format attendu</AlertTitle>
                <AlertDescription>
                  Format CSV attendu (avec en-têtes) :
                  <code className="block mt-2 p-2 bg-muted rounded text-xs">
                    course_id,coureur_id,type_classement,etape_numero,position,statut,date_classement,saison_id
                  </code>
                  <ul className="mt-2 text-xs space-y-1">
                    <li>• <strong>saison_id</strong> : Année (ex: 2025) ou UUID complet (obligatoire)</li>
                    <li>• <strong>date_classement</strong> : DD/MM/YYYY ou YYYY-MM-DD</li>
                    <li>• <strong>type_classement</strong> : Général, Etape, Points, Montagne, etc.</li>
                    <li>• <strong>etape_numero</strong> : numéro (pour type Etape) ou vide</li>
                    <li>• <strong>statut</strong> : finished, dnf, dns, etc.</li>
                  </ul>
                  <p className="text-xs mt-2 font-semibold">
                    ⚡ Les points sont recalculés automatiquement après l'import
                  </p>
                </AlertDescription>
        </Alert>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>⚠️ Attention</AlertTitle>
          <AlertDescription className="text-xs">
            L'import nécessite que les courses et coureurs existent déjà en base.
            Le fichier doit contenir le saison_id dans chaque ligne.
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
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Import et recalcul en cours...</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Importer et calculer les points</>
          )}
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
};

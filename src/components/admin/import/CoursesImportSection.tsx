import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2, Info, MapPin } from "lucide-react";
import { generateCoursesTemplate, downloadCSV } from "@/lib/exportTemplates";
import { useQuery } from "@tanstack/react-query";

export const CoursesImportSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleDownloadTemplate = () => {
    downloadCSV(generateCoursesTemplate(), 'template_courses.csv');
    toast({
      title: "✅ Template téléchargé",
      description: "Le fichier template_courses.csv a été téléchargé",
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
          table: 'courses',
          data: csvData,
        },
      });

      if (error) throw error;

      toast({
        title: "✅ Import réussi",
        description: `${data.imported || 0} courses importées`,
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
    <AccordionItem value="courses">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span>Courses</span>
          <Badge variant="secondary">~100 lignes</Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="space-y-4 pt-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Format attendu</AlertTitle>
          <AlertDescription>
            <code className="text-xs block mb-2 bg-muted p-2 rounded">
              id;nom;categorie;type_course;date_debut;date_fin;phase_id
            </code>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li><strong>id</strong> : Identifiant unique (ex: P1R1, P2R5) ou vide (généré depuis le nom)</li>
              <li><strong>phase_id</strong> : UUID exact, "Phase 1"/"Phase 2", ou vide (déduit depuis les dates)</li>
              <li><strong>dates</strong> : Format YYYY-MM-DD ou DD/MM/YYYY</li>
              <li><strong>categorie</strong> : WT, ProSeries, 1.UWT, etc.</li>
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

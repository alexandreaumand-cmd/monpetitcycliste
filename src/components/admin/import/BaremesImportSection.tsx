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
import { useQuery } from "@tanstack/react-query";
import { Download, Upload, Loader2, Info, BarChart } from "lucide-react";
import { generateBaremesTemplate, downloadCSV } from "@/lib/exportTemplates";

export const BaremesImportSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [saisonId, setSaisonId] = useState<string>("");
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

  const handleDownloadTemplate = () => {
    downloadCSV(generateBaremesTemplate(), 'template_baremes.csv');
    toast({
      title: "✅ Template téléchargé",
      description: "Le fichier template_baremes.csv a été téléchargé",
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

    if (!saisonId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une saison",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const csvData = await file.text();
      
      const { data, error } = await supabase.functions.invoke('import-data', {
        body: {
          table: 'scoring_rules',
          data: csvData,
          saison_id: saisonId,
        },
      });

      if (error) throw error;

      toast({
        title: "✅ Import réussi",
        description: `${data.imported || 0} barèmes importés`,
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
    <AccordionItem value="baremes">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <BarChart className="h-4 w-4" />
          <span>Barèmes</span>
          <Badge variant="secondary">~200 lignes</Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="space-y-4 pt-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Format attendu</AlertTitle>
          <AlertDescription>
            <code className="text-xs block mb-2 bg-muted p-2 rounded">
              id;Catégorie;Type classement;Place;Points;Type
            </code>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li><strong>Catégorie</strong> : WT, ProSeries, 1.UWT, etc.</li>
              <li><strong>Type classement</strong> : General, Etape, Montagne, etc.</li>
              <li><strong>Place</strong> : Position (1, 2, 3...)</li>
              <li><strong>Points</strong> : Nombre de points attribués</li>
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
          <Label>Saison</Label>
          <Select value={saisonId} onValueChange={setSaisonId}>
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
        </div>

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
          disabled={!file || !saisonId || importing}
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

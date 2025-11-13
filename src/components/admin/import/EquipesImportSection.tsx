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
import { Download, Upload, Loader2, Info, Shield } from "lucide-react";
import { generateEquipesTemplate, downloadCSV } from "@/lib/exportTemplates";

export const EquipesImportSection = () => {
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
    downloadCSV(generateEquipesTemplate(), 'template_equipes.csv');
    toast({
      title: "✅ Template téléchargé",
      description: "Le fichier template_equipes.csv a été téléchargé",
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
          table: 'equipes',
          data: csvData,
          saison_id: saisonId,
        },
      });

      if (error) throw error;

      toast({
        title: "✅ Import réussi",
        description: data.details 
          ? `${data.details.imported_count} équipes importées sur ${data.details.total_rows} lignes (${data.details.new_equipes} nouvelles, ${data.details.error_count} erreurs)`
          : `${data.imported || 0} équipes importées`,
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
    <AccordionItem value="equipes">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>Équipes</span>
          <Badge variant="secondary">~50 lignes</Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="space-y-4 pt-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Format attendu</AlertTitle>
          <AlertDescription>
            <code className="text-xs block mb-2 bg-muted p-2 rounded">
              Code court;Nom complet;Nom affiché;Catégorie;Pays;Logo URL
            </code>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li><strong>Code court</strong> : Code unique de l'équipe (ex: UAD, SKA)</li>
              <li><strong>Nom complet</strong> : Nom officiel complet</li>
              <li><strong>Nom affiché</strong> : Version courte pour l'affichage</li>
              <li><strong>Catégorie</strong> : WT, PT ou CT (optionnel)</li>
              <li><strong>Pays</strong> : Pays de l'équipe (optionnel)</li>
              <li><strong>Logo URL</strong> : URL du logo (optionnel)</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="saison-equipes">Saison *</Label>
          <Select value={saisonId} onValueChange={setSaisonId}>
            <SelectTrigger id="saison-equipes">
              <SelectValue placeholder="Sélectionner une saison" />
            </SelectTrigger>
            <SelectContent>
              {saisons?.map((saison) => (
                <SelectItem key={saison.id} value={saison.id}>
                  {saison.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file-equipes">Fichier CSV</Label>
          <Input
            id="file-equipes"
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={importing}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
            size="sm"
            disabled={importing}
          >
            <Download className="mr-2 h-4 w-4" />
            Template
          </Button>

          <Button
            onClick={handleImport}
            disabled={!file || !saisonId || importing}
            size="sm"
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importer
              </>
            )}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

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
import { Download, Upload, Loader2, Info, Users } from "lucide-react";
import { generateCoureursTemplate, downloadCSV } from "@/lib/exportTemplates";

export const CoureursImportSection = () => {
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
    downloadCSV(generateCoureursTemplate(), 'template_coureurs.csv');
    toast({
      title: "✅ Template téléchargé",
      description: "Le fichier template_coureurs.csv a été téléchargé",
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
          table: 'coureurs',
          data: csvData,
          saison_id: saisonId,
        },
      });

      if (error) throw error;

      toast({
        title: "✅ Import réussi",
        description: data.details 
          ? `${data.details.imported_count} coureurs importés sur ${data.details.total_rows} lignes (${data.details.error_count} erreurs)`
          : `${data.imported || 0} coureurs importés`,
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
    <AccordionItem value="coureurs">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>Coureurs</span>
          <Badge variant="secondary">~500 lignes</Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="space-y-4 pt-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Format attendu</AlertTitle>
          <AlertDescription>
            <code className="text-xs block mb-2 bg-muted p-2 rounded">
              Coureur;Equipe;Prix initial;id
            </code>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li><strong>Coureur</strong> : Nom complet (ex: Tadej POGACAR)</li>
              <li><strong>Equipe</strong> : Nom de l'équipe</li>
              <li><strong>Prix initial</strong> : 10 à 120</li>
              <li><strong>id</strong> : Identifiant unique (optionnel, auto-généré si vide)</li>
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

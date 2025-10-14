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
import { Download, Upload, Loader2, Info, Trophy, AlertCircle } from "lucide-react";
import { generateResultatsTemplate, downloadCSV } from "@/lib/exportTemplates";
import { useQuery } from "@tanstack/react-query";

export const ResultatsImportSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [saisonId, setSaisonId] = useState<string>("");
  const { toast } = useToast();

  const { data: saisons } = useQuery({
    queryKey: ['saisons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

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
          table: 'resultats',
          data: csvData,
          saison_id: saisonId,
        },
      });

      if (error) throw error;

      toast({
        title: "✅ Import réussi",
        description: `${data.imported || 0} résultats importés`,
      });

      setFile(null);
      setSaisonId("");
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
            <code className="text-xs block mb-2 bg-muted p-2 rounded">
              course_id;coureur_id;type_classement;position;statut;etape_numero;date_classement
            </code>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li><strong>course_id</strong> : ID de la course (ex: P1R1)</li>
              <li><strong>coureur_id</strong> : ID du coureur</li>
              <li><strong>type_classement</strong> : General, Etape, Montagne, etc.</li>
              <li><strong>position</strong> : Position (1, 2, 3...)</li>
              <li><strong>statut</strong> : finished, dnf, dns</li>
              <li><strong>etape_numero</strong> : Numéro d'étape (vide pour classements généraux)</li>
              <li><strong>date_classement</strong> : Date du résultat (YYYY-MM-DD)</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>⚠️ Attention</AlertTitle>
          <AlertDescription className="text-xs">
            L'import de résultats nécessite que les courses et coureurs existent déjà en base.
            Utilisez l'outil d'import dans l'onglet "Courses" pour gérer les résultats de manière interactive.
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
          <Label>Saison cible</Label>
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

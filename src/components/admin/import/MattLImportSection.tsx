import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Info, Zap, AlertTriangle } from "lucide-react";

export const MattLImportSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

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
    setResult(null);

    try {
      const csvData = await file.text();
      
      const { data, error } = await supabase.functions.invoke('admin-import-matt-l-results', {
        body: { csv_content: csvData },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Import échoué');
      }

      setResult(data);

      toast({
        title: "✅ Import Matt L réussi",
        description: `${data.imported || 0} résultats importés, ${data.courses_affected?.length || 0} course(s) recalculée(s)`,
      });

      setFile(null);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.value = '';
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erreur d'import Matt L",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AccordionItem value="matt-l">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span>Import Matt L</span>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            Format spécial
          </Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="space-y-4 pt-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Format Matt L détecté</AlertTitle>
          <AlertDescription>
            Format CSV attendu (avec en-têtes) :
            <code className="block mt-2 p-2 bg-muted rounded text-xs">
              Coureur,Nom_Course,Code_Course,Phase,Classement2,Type_Class,Date
            </code>
            <ul className="mt-2 text-xs space-y-1">
              <li>• <strong>Coureur</strong> : Nom complet (ex: "Luke PLAPP")</li>
              <li>• <strong>Code_Course</strong> : Code court (ex: "TDU", "SAUDI")</li>
              <li>• <strong>Phase</strong> : 1-5 (mapping automatique vers saison)</li>
              <li>• <strong>Classement2</strong> : Position (0 pour bonus/maillot)</li>
              <li>• <strong>Type_Class</strong> : "GC", "etape01", "etape02", "maillot"</li>
              <li>• <strong>Date</strong> : Format JJ/MM/AAAA (ex: "21/1/2025")</li>
            </ul>
            <p className="text-xs mt-2 font-semibold text-green-600">
              ✨ Matching intelligent : noms coureurs + codes courses automatiques
            </p>
            <p className="text-xs mt-1 font-semibold text-blue-600">
              ⚡ Recalcul automatique des points après import
            </p>
          </AlertDescription>
        </Alert>

        <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/5">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle>Transformations automatiques</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>• Noms coureurs : normalisation + matching fuzzy (≥80% similarité)</p>
            <p>• Codes courses : mapping automatique (TDU → P1R1, etc.)</p>
            <p>• Type_Class : "GC" → "General", "etape01" → "Etape" n°1</p>
            <p>• Position 0 + type "maillot" : ignorés (bonus points)</p>
            <p>• Courses annulées : détectées et ignorées</p>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Fichier CSV (format Matt L)</Label>
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
          variant="default"
        >
          {importing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Import Matt L en cours...</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Importer Matt L et calculer les points</>
          )}
        </Button>

        {result && (
          <div className="space-y-3 pt-2">
            <Alert className="bg-green-500/10 border-green-500/20">
              <AlertTitle className="text-green-600">Résultat de l'import</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>✅ <strong>{result.imported}</strong> résultats importés</p>
                <p>🏁 <strong>{result.courses_affected?.length || 0}</strong> course(s) recalculée(s)</p>
                {result.warnings && result.warnings.length > 0 && (
                  <p>⚠️ <strong>{result.warnings.length}</strong> avertissement(s)</p>
                )}
                {result.errors && result.errors.length > 0 && (
                  <p className="text-red-600">❌ <strong>{result.errors.length}</strong> erreur(s)</p>
                )}
              </AlertDescription>
            </Alert>

            {result.errors && result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Erreurs détectées</AlertTitle>
                <AlertDescription className="text-xs max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 10).map((err: any, idx: number) => (
                    <div key={idx} className="mb-1">
                      Ligne {err.line}: {err.error}
                    </div>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="mt-2 font-semibold">
                      ... et {result.errors.length - 10} autres erreurs
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {result.warnings && result.warnings.length > 0 && (
              <Alert className="border-yellow-500/50">
                <AlertTitle className="text-yellow-600">Avertissements</AlertTitle>
                <AlertDescription className="text-xs max-h-32 overflow-y-auto">
                  {result.warnings.slice(0, 5).map((warn: string, idx: number) => (
                    <div key={idx} className="mb-1">{warn}</div>
                  ))}
                  {result.warnings.length > 5 && (
                    <p className="mt-2 font-semibold">
                      ... et {result.warnings.length - 5} autres avertissements
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

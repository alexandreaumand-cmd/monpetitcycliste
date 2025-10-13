import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, AlertCircle, CheckCircle, Eye } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PreviewResult {
  imported?: number;
  errors?: number;
  errorDetails?: string[];
  unmappedPhases?: string[];
  sampleMappedPhaseIds?: string[];
  message?: string;
}

export const CoursesImportManager = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [phaseMapping, setPhaseMapping] = useState<string>("");
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewResult(null);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier CSV",
        variant: "destructive",
      });
      return;
    }

    setPreviewing(true);

    try {
      const csvData = await file.text();
      
      const { data, error } = await supabase.functions.invoke('import-data', {
        body: {
          table: 'courses',
          data: csvData,
        },
      });

      if (error) throw error;

      setPreviewResult(data);

      if (data.unmappedPhases && data.unmappedPhases.length > 0) {
        toast({
          title: "⚠️ Phases non mappées",
          description: `${data.unmappedPhases.length} phase(s) n'ont pas pu être mappées automatiquement`,
          variant: "default",
        });
      } else {
        toast({
          title: "✅ Prévisualisation réussie",
          description: data.message,
        });
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: "Erreur de prévisualisation",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setPreviewing(false);
    }
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

    // Check if there are unmapped phases
    if (previewResult?.unmappedPhases && previewResult.unmappedPhases.length > 0) {
      toast({
        title: "⚠️ Phases non mappées",
        description: "Veuillez mapper toutes les phases avant d'importer ou corrigez le fichier CSV",
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
        description: data.message,
      });

      // Reset form
      setFile(null);
      setPreviewResult(null);
      setPhaseMapping("");
      const fileInput = document.getElementById('courses-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erreur d'importation",
        description: error.message || "Une erreur est survenue lors de l'importation",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>📥 Importer des courses depuis CSV</CardTitle>
        <CardDescription>
          Import robuste avec détection automatique du format Excel, mapping des phases et validation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File upload section */}
        <div className="space-y-2">
          <Label htmlFor="courses-file-input">Fichier CSV</Label>
          <Input
            id="courses-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Preview button */}
        <Button
          onClick={handlePreview}
          disabled={!file || previewing || importing}
          variant="outline"
          className="w-full"
        >
          {previewing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Prévisualiser
            </>
          )}
        </Button>

        {/* Preview results */}
        {previewResult && (
          <div className="space-y-4">
            <Separator />
            
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Résumé de la prévisualisation:</p>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    <li>✅ {previewResult.imported || 0} courses valides prêtes à être importées</li>
                    {previewResult.errors ? <li>❌ {previewResult.errors} erreurs détectées</li> : null}
                    {previewResult.unmappedPhases && previewResult.unmappedPhases.length > 0 ? (
                      <li className="text-orange-600">⚠️ {previewResult.unmappedPhases.length} phase(s) non mappée(s)</li>
                    ) : null}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            {/* Sample mapped phases */}
            {previewResult.sampleMappedPhaseIds && previewResult.sampleMappedPhaseIds.length > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Phases mappées (échantillon):</p>
                <div className="flex flex-wrap gap-1">
                  {previewResult.sampleMappedPhaseIds.map((id, idx) => (
                    <code key={idx} className="text-xs bg-background px-2 py-1 rounded">
                      {id.slice(0, 8)}...
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Unmapped phases warning */}
            {previewResult.unmappedPhases && previewResult.unmappedPhases.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Phases non mappées:</p>
                  <div className="flex flex-wrap gap-2">
                    {previewResult.unmappedPhases.map((phase, idx) => (
                      <code key={idx} className="text-xs bg-destructive/10 px-2 py-1 rounded">
                        {phase}
                      </code>
                    ))}
                  </div>
                  <p className="text-sm mt-2">
                    Veuillez corriger le fichier CSV en utilisant les noms exacts des phases 
                    (Phase 1, Phase 2, etc.) ou les UUID des phases existantes.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Error details */}
            {previewResult.errorDetails && previewResult.errorDetails.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Détails des erreurs:</p>
                <div className="bg-muted p-3 rounded-lg max-h-40 overflow-y-auto">
                  {previewResult.errorDetails.map((error, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground font-mono">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Import button */}
        <Button
          onClick={handleImport}
          disabled={!file || !previewResult || importing || previewing || 
                   (previewResult?.unmappedPhases && previewResult.unmappedPhases.length > 0)}
          className="w-full"
        >
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Import en cours...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Importer maintenant
            </>
          )}
        </Button>

        {/* Format info */}
        <Alert>
          <AlertDescription>
            <p className="font-medium mb-2">Format CSV attendu:</p>
            <code className="text-xs">id,nom,categorie,type_course,date_debut,date_fin,phase_id</code>
            <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
              <li><strong>✨ Mapping automatique des phases</strong>: "Phase 1", "Phase 2", "1", "2" ou UUID</li>
              <li><strong>🔍 Détection automatique de la saison</strong> depuis l'année des dates</li>
              <li><strong>Dates</strong>: YYYY-MM-DD, DD/MM/YYYY ou MM/DD/YYYY</li>
              <li><strong>Séparateur</strong>: virgule ou point-virgule (auto-détecté)</li>
              <li><strong>id</strong> sera généré automatiquement si vide</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

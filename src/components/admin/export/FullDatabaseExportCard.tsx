import { useState } from "react";
import { Database, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TABLES_COUNT = 44;

export const FullDatabaseExportCard = () => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setExporting(true);
    setProgress(10);

    try {
      // Simulate progress while waiting for the export
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      const { data, error } = await supabase.functions.invoke('export-all-tables', {
        method: 'POST',
      });

      clearInterval(progressInterval);

      if (error) {
        throw error;
      }

      if (!data || !data.download_url) {
        throw new Error('Réponse invalide du serveur');
      }

      setProgress(95);

      // Download via signed URL (more reliable than passing binary/Base64 through invoke)
      const resp = await fetch(data.download_url);
      if (!resp.ok) {
        throw new Error('Téléchargement du fichier échoué');
      }

      const blob = await resp.blob();

      setProgress(100);

      const link = document.createElement('a');
      link.download = data.filename || `database_backup_${new Date().toISOString().split('T')[0]}.zip`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success(`Export complet téléchargé (${data.tables_count || TABLES_COUNT} tables)`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Erreur lors de l'export de la base de données");
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  return (
    <Card className="border-2 border-primary bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5 text-primary" />
          Export complet de la base
        </CardTitle>
        <CardDescription>
          Exporter toutes les {TABLES_COUNT} tables au format CSV dans un fichier ZIP compressé
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {exporting && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Export en cours... {progress}%
            </p>
          </div>
        )}
        <Button 
          onClick={handleExport} 
          disabled={exporting} 
          className="w-full"
          size="lg"
        >
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Export en cours...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Télécharger backup complet (ZIP)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

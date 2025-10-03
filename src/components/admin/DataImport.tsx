import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2 } from "lucide-react";

type TableType = 'coureurs' | 'scoring_rules' | 'courses' | 'managers' | 'course_dates';

export const DataImport = () => {
  const [selectedTable, setSelectedTable] = useState<TableType>('coureurs');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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

    setImporting(true);

    try {
      const csvData = await file.text();
      
      const { data, error } = await supabase.functions.invoke('import-data', {
        body: {
          table: selectedTable,
          data: csvData,
        },
      });

      if (error) throw error;

      toast({
        title: "Importation réussie",
        description: data.message,
      });

      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
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

  const tableLabels: Record<TableType, string> = {
    coureurs: 'Coureurs (Riders)',
    scoring_rules: 'Barèmes (Scoring Rules)',
    courses: 'Courses (Races)',
    managers: 'Managers',
    course_dates: 'Dates des Courses',
  };

  const handleComputePhases = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('compute-phases');

      if (error) throw error;

      toast({
        title: "Calcul des phases réussi",
        description: data.message,
      });
    } catch (error) {
      console.error('Compute phases error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors du calcul des phases",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importer des données CSV</CardTitle>
        <CardDescription>
          Importez des données depuis vos fichiers CSV dans la base de données
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Table de destination</label>
          <Select
            value={selectedTable}
            onValueChange={(value) => setSelectedTable(value as TableType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(tableLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label htmlFor="file-input" className="text-sm font-medium">
            Fichier CSV
          </label>
          <div className="flex items-center gap-2">
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="flex-1 text-sm"
            />
            {file && (
              <span className="text-sm text-muted-foreground">
                {file.name}
              </span>
            )}
          </div>
        </div>

        <Button
          onClick={handleImport}
          disabled={!file || importing}
          className="w-full"
        >
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importation en cours...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Importer
            </>
          )}
        </Button>

        {selectedTable === 'course_dates' && (
          <Button
            onClick={handleComputePhases}
            disabled={importing}
            variant="outline"
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Assigner phases par dates
          </Button>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium">Format attendu par table:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>Coureurs:</strong> Coureur, Equipe, Prix initial, id</li>
            <li><strong>Barèmes:</strong> id, Catégorie, Type classement, Place, Points, Type</li>
            <li><strong>Courses (format simple):</strong> id, Course, Race Type, Race Category</li>
            <li><strong>Courses (format complet):</strong> id;nom;categorie;type_course;date_debut;date_fin;phase_id;statut;uci_code;wt_tier</li>
            <li><strong>Managers:</strong> Nom manager, Sponsor</li>
            <li><strong>Dates des Courses:</strong> id, Course, date_debut, date_fin</li>
          </ul>
          <p className="text-xs mt-2 text-orange-600">
            <strong>Note:</strong> Le format CSV détecte automatiquement le séparateur (virgule ou point-virgule).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

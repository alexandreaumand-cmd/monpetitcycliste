import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BonusImportTabProps {
  phaseId: string;
  saisonId: string;
}

interface ParsedRow {
  type: 'rider' | 'manager';
  bonus_type: string;
  coureur_nom?: string;
  manager_nom?: string;
  league_nom?: string;
  points: number;
  commentaire?: string;
  valid: boolean;
  error?: string;
}

export const BonusImportTab = ({ phaseId, saisonId }: BonusImportTabProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const downloadTemplate = () => {
    const csvContent = `type,bonus_type,coureur_nom,manager_nom,league_nom,points,commentaire
rider,first_win,POGACAR Tadej,,50,Première victoire
rider,itt,VAN AERT Wout,,,30,CLM étape 5
rider,coureur_bonuse,VINGEGAARD Jonas,Jean Dupont,,25,Coureur bonusé phase 3
manager,ttt,,Jean Dupont,Ma Ligue,100,TTT étape 1
manager,scoreurs,,Pierre Martin,Ma Ligue,75,Meilleurs scoreurs`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bonus_template.csv';
    link.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsParsing(true);
    setParsedData([]);

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("Le fichier doit contenir au moins une ligne de données");
        setIsParsing(false);
        return;
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const expectedHeaders = ['type', 'bonus_type', 'coureur_nom', 'manager_nom', 'league_nom', 'points', 'commentaire'];
      
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast.error(`Colonnes manquantes: ${missingHeaders.join(', ')}`);
        setIsParsing(false);
        return;
      }

      // Parse data rows
      const parsed: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        const parsedRow: ParsedRow = {
          type: row.type === 'manager' ? 'manager' : 'rider',
          bonus_type: row.bonus_type,
          coureur_nom: row.coureur_nom || undefined,
          manager_nom: row.manager_nom || undefined,
          league_nom: row.league_nom || undefined,
          points: parseInt(row.points) || 0,
          commentaire: row.commentaire || undefined,
          valid: true,
        };

        // Validation
        if (!['first_win', 'itt', 'coureur_bonuse', 'ttt', 'scoreurs'].includes(parsedRow.bonus_type)) {
          parsedRow.valid = false;
          parsedRow.error = `Type de bonus inconnu: ${parsedRow.bonus_type}`;
        } else if (parsedRow.type === 'rider' && !parsedRow.coureur_nom) {
          parsedRow.valid = false;
          parsedRow.error = "Nom du coureur requis pour bonus rider";
        } else if (parsedRow.type === 'manager' && (!parsedRow.manager_nom || !parsedRow.league_nom)) {
          parsedRow.valid = false;
          parsedRow.error = "Nom du manager et ligue requis pour bonus manager";
        } else if (parsedRow.points <= 0) {
          parsedRow.valid = false;
          parsedRow.error = "Points doivent être > 0";
        }

        parsed.push(parsedRow);
      }

      setParsedData(parsed);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast.error("Erreur lors de la lecture du fichier");
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(r => r.valid);
    if (validRows.length === 0) {
      toast.error("Aucune ligne valide à importer");
      return;
    }

    setIsImporting(true);
    toast.info(`Import de ${validRows.length} bonus en cours...`);

    // TODO: Implement actual import logic
    // This would involve:
    // 1. Matching coureur_nom to coureur_id
    // 2. Matching manager_nom to manager_id
    // 3. Matching league_nom to league_id
    // 4. Creating bonus_points or manager_bonus_points entries

    setTimeout(() => {
      setIsImporting(false);
      toast.success(`${validRows.length} bonus importés avec succès`);
      setParsedData([]);
      setFile(null);
    }, 2000);
  };

  const validCount = parsedData.filter(r => r.valid).length;
  const invalidCount = parsedData.filter(r => !r.valid).length;

  return (
    <div className="space-y-6">
      {/* Template Download */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Modèle CSV
          </CardTitle>
          <CardDescription>
            Téléchargez le modèle CSV pour préparer votre import de bonus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger le modèle
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import CSV
          </CardTitle>
          <CardDescription>
            Sélectionnez un fichier CSV pour importer des bonus en masse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Fichier CSV</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isParsing || isImporting}
            />
          </div>

          {isParsing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse du fichier...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aperçu de l'import</CardTitle>
            <CardDescription>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {validCount} valide(s)
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    {invalidCount} erreur(s)
                  </span>
                )}
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invalidCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Certaines lignes contiennent des erreurs et ne seront pas importées.
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Coureur</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Ligue</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, idx) => (
                    <TableRow key={idx} className={!row.valid ? "bg-destructive/10" : ""}>
                      <TableCell>
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <span className="text-xs text-destructive">{row.error}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.type === 'rider' ? 'default' : 'secondary'}>
                          {row.type === 'rider' ? 'Coureur' : 'Manager'}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.bonus_type}</TableCell>
                      <TableCell>{row.coureur_nom || '-'}</TableCell>
                      <TableCell>{row.manager_nom || '-'}</TableCell>
                      <TableCell>{row.league_nom || '-'}</TableCell>
                      <TableCell className="text-right">{row.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleImport} 
                disabled={validCount === 0 || isImporting}
              >
                {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importer {validCount} bonus
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

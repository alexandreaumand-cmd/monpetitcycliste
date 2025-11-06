import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Info, Zap, AlertTriangle, Download } from "lucide-react";

const downloadErrorsCSV = (errors: any[]) => {
  const csvContent = [
    'Ligne,Type,Coureur,Course,Code_Course,Détails',
    ...errors.map(e => 
      `${e.line || 'N/A'},"${e.type || ''}","${e.riderName || ''}","${e.courseName || ''}","${e.courseCode || ''}","${e.details || e.raw || ''}"`
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-errors-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

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
      
      console.log('CSV file size:', file.size, 'bytes');
      console.log('CSV content preview:', csvData.substring(0, 200));
      console.log('CSV lines count:', csvData.split('\n').filter(l => l.trim()).length);
      
      if (!csvData || csvData.trim().length === 0) {
        throw new Error('Le fichier CSV est vide');
      }
      
      const { data, error } = await supabase.functions.invoke('admin-import-matt-l-results', {
        body: { csv_content: csvData },
      });

      if (error) throw error;

      // Toujours afficher le rapport, même si success === false
      setResult(data);

      if (data.success) {
        toast({
          title: "✅ Import Matt L réussi",
          description: `${data.imported || 0} résultats importés, ${data.courses_affected?.length || 0} course(s) recalculée(s)`,
        });
      } else {
        toast({
          title: "⚠️ Analyse terminée",
          description: "0 ligne importée. Consultez le rapport ci-dessous.",
          variant: "default",
        });
      }

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

        {result && result.imported !== undefined && (
          <div className="space-y-3 pt-2">
            {/* Résumé global */}
            <Alert className={result.imported > 0 ? "bg-green-500/10 border-green-500/20" : "bg-yellow-500/10 border-yellow-500/20"}>
              <AlertTitle className={result.imported > 0 ? "text-green-600" : "text-yellow-600"}>
                Résultat de l'import
              </AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                {result.imported > 0 ? (
                  <>
                    <p>✅ <strong>{result.imported}</strong> résultats importés</p>
                    <p>🏁 <strong>{result.courses_affected?.length || 0}</strong> course(s) recalculée(s)</p>
                  </>
                ) : (
                  <p>⚠️ <strong>Aucune ligne importée</strong> — Consultez les erreurs ci-dessous</p>
                )}
                {result.warnings && result.warnings.length > 0 && (
                  <p>⚠️ <strong>{result.warnings.length}</strong> avertissement(s)</p>
                )}
                {result.errors && result.errors.length > 0 && (
                  <p className="text-red-600">❌ <strong>{result.errors.length}</strong> erreur(s)</p>
                )}
              </AlertDescription>
            </Alert>

            {/* Section coureurs non trouvés */}
            {result.errorsByType?.riders_not_found?.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>
                  Coureurs non trouvés ({result.errorsByType.riders_not_found.length} unique(s))
                </AlertTitle>
                <AlertDescription className="text-xs">
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errorsByType.riders_not_found.map((name: string, idx: number) => (
                      <div key={idx} className="font-mono">• {name || 'Nom inconnu'}</div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Section courses non trouvées */}
            {result.errorsByType?.courses_not_found?.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>
                  Courses non trouvées ({result.errorsByType.courses_not_found.length} unique(s))
                </AlertTitle>
                <AlertDescription className="text-xs">
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errorsByType.courses_not_found.map((name: string, idx: number) => (
                      <div key={idx} className="font-mono">• {name || 'Nom inconnu'}</div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* ⭐ NOUVEAU: Section rapport par course */}
            {result.course_report && result.course_report.length > 0 && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Info className="h-4 w-4 mr-2 text-blue-600" />
                    Rapport détaillé par course ({result.course_report.length} course(s) tentée(s))
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {result.course_report.map((course: any, idx: number) => (
                      <Alert 
                        key={idx}
                        className={course.imported > 0 
                          ? "border-green-500/50 bg-green-500/5" 
                          : "border-red-500/50 bg-red-500/5"
                        }
                      >
                        <AlertTitle className="text-sm font-semibold">
                          {course.courseName}
                          {course.courseId && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {course.courseId}
                            </Badge>
                          )}
                        </AlertTitle>
                        <AlertDescription className="text-xs space-y-1 mt-2">
                          <div className="flex gap-4">
                            {course.imported > 0 && (
                              <span className="text-green-600 font-medium">
                                ✅ {course.imported} importé(s)
                              </span>
                            )}
                            {course.failed > 0 && (
                              <span className="text-red-600 font-medium">
                                ❌ {course.failed} rejeté(s)
                              </span>
                            )}
                          </div>
                          
                          {course.errors && course.errors.length > 0 && (
                            <div className="mt-2 pl-2 border-l-2 border-red-500/30">
                              <div className="font-semibold text-red-600 mb-1">
                                Échecs détaillés :
                              </div>
                              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                                {course.errors.slice(0, 10).map((err: any, i: number) => (
                                  <div key={i} className="text-muted-foreground font-mono text-[11px]">
                                    • {err.riderName} 
                                    {err.position !== undefined && ` (pos ${err.position})`}
                                    {' - '}
                                    <span className="text-red-500">
                                      {err.reason === 'rider_not_found' && 'coureur inconnu'}
                                      {err.reason === 'course_not_found' && 'course inconnue'}
                                      {err.reason === 'invalid_format' && 'format invalide'}
                                      {err.reason === 'season_not_found' && 'saison introuvable'}
                                    </span>
                                  </div>
                                ))}
                                {course.errors.length > 10 && (
                                  <div className="text-muted-foreground italic">
                                    ... et {course.errors.length - 10} autre(s)
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Section warnings de matching */}
            {result.warnings && result.warnings.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
                    Voir les {result.warnings.length} correspondances approximatives
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Alert className="border-yellow-500/50">
                    <AlertDescription className="text-xs max-h-60 overflow-y-auto space-y-2">
                      {result.warnings.map((warn: any, idx: number) => (
                        <div key={idx} className="border-l-2 border-yellow-500 pl-2">
                          <div className="font-semibold">Ligne {warn.line || 'N/A'}</div>
                          {warn.inputValue && warn.matchedValue && (
                            <div>"{warn.inputValue}" → "{warn.matchedValue}"</div>
                          )}
                          {warn.message && !warn.inputValue && (
                            <div>{warn.message}</div>
                          )}
                          {warn.score !== undefined && warn.method && (
                            <div className="text-muted-foreground">
                              Score: {(warn.score * 100).toFixed(0)}% ({warn.method})
                            </div>
                          )}
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Bouton export CSV des erreurs */}
            {result.errors && result.errors.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => downloadErrorsCSV(result.errors)}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger le rapport d'erreurs (CSV)
              </Button>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

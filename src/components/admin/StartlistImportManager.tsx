import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, FileText } from "lucide-react";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StartlistRaceCards } from "./StartlistRaceCards";
import { StartlistDetailView } from "./StartlistDetailView";

type ViewMode = 'list' | 'import' | 'detail';

export const StartlistImportManager = () => {
  const { phases } = useSeasonContext();
  const queryClient = useQueryClient();
  
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedStartlistId, setSelectedStartlistId] = useState<string | null>(null);
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [isReimport, setIsReimport] = useState(false);
  
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [selectedRaceId, setSelectedRaceId] = useState<string>("all");
  const [textContent, setTextContent] = useState<string>("");
  const [startlisteurNote, setStartlisteurNote] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch courses for selected phase (only in import mode)
  const { data: courses } = useQuery({
    queryKey: ['phase-courses', selectedPhaseId],
    queryFn: async () => {
      if (!selectedPhaseId) return [];
      
      const { data, error } = await supabase
        .from('courses')
        .select('id, nom, date_debut, date_fin')
        .eq('phase_id', selectedPhaseId)
        .order('date_debut', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedPhaseId && viewMode === 'import'
  });

  const handleParse = async () => {
    if (!textContent.trim()) {
      toast.error("Veuillez coller le texte de la startlist");
      return;
    }

    if (!selectedPhaseId) {
      toast.error("Veuillez sélectionner une phase");
      return;
    }

    if (!selectedRaceId || selectedRaceId === 'all') {
      toast.error("Veuillez sélectionner une course");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('startlist-parse-text', {
        body: { 
          race_id: selectedRaceId,
          phase_id: selectedPhaseId,
          text: textContent,
          with_diagnostics: false,
          startlisteur_note: startlisteurNote.trim() || null
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
      
      toast.success(
        `Startlist enregistrée : ${data.counts.matched_db} coureurs matchés sur ${data.counts.parsed}`
      );

      // Retour à la liste après import réussi
      setViewMode('list');
      setSelectedRace(null);
      setSelectedPhaseId("");
      setSelectedRaceId("all");
      setTextContent("");
      setStartlisteurNote("");
      setIsReimport(false);
      
    } catch (error: any) {
      console.error('Parse error:', error);
      
      // Extract detailed error message from FunctionsHttpError
      let errorMessage = "Erreur lors du parsing";
      
      if (error.context?.body) {
        try {
          const errorBody = typeof error.context.body === 'string' 
            ? JSON.parse(error.context.body) 
            : error.context.body;
          
          if (errorBody.error) {
            errorMessage = errorBody.error;
            
            // Special hint for authentication errors
            if (errorBody.code === 'UNAUTHENTICATED') {
              errorMessage += " 🔒 Reconnectez-vous pour continuer.";
            }
          }
        } catch (parseError) {
          // Fallback to generic message
          errorMessage = error.message || "Erreur inconnue";
        }
      } else {
        errorMessage = error.message || "Erreur inconnue";
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedPhaseId) {
      toast.error("Veuillez d'abord sélectionner une phase");
      return;
    }

    if (!selectedRaceId || selectedRaceId === 'all') {
      toast.error("Veuillez sélectionner une course");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('phase_id', selectedPhaseId);
      formData.append('race_id', selectedRaceId);

      const { data, error } = await supabase.functions.invoke('startlist-upload-and-parse', {
        body: formData
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
      
      toast.success(
        `Fichier importé : ${data.counts.matched_db} coureurs matchés sur ${data.counts.parsed}`
      );

      // Retour à la liste après import réussi
      setViewMode('list');
      setSelectedRace(null);
      setSelectedPhaseId("");
      setSelectedRaceId("all");
      setIsReimport(false);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Erreur lors de l'upload: " + error.message);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  // Mode "list" : afficher la grille de vignettes (vue par défaut)
  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Gestion des Startlists</h2>
          <p className="text-muted-foreground mt-1">
            Cliquez sur une course pour importer ou consulter sa startlist
          </p>
        </div>
        
        <StartlistRaceCards 
          onRaceClick={(race, startlistId) => {
            if (startlistId) {
              // Course avec startlist → mode détail
              setSelectedStartlistId(startlistId);
              setSelectedRace(race);
              setViewMode('detail');
            } else {
              // Course sans startlist → mode import
              setSelectedRace(race);
              setSelectedPhaseId(race.phase_id);
              setSelectedRaceId(race.id);
              setViewMode('import');
            }
          }}
          isSuperAdmin={true}
        />
      </div>
    );
  }

  // Mode "import" : afficher les formulaires
  if (viewMode === 'import') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => {
              setViewMode('list');
              setSelectedRace(null);
              setSelectedPhaseId("");
              setSelectedRaceId("all");
              setTextContent("");
              setStartlisteurNote("");
              setIsReimport(false);
            }}
          >
            ← Retour à la liste
          </Button>
          <div>
            <h2 className="text-2xl font-bold">
              {isReimport ? 'Réimporter la startlist' : 'Import de startlist'}
              {selectedRace && ` - ${selectedRace.nom}`}
            </h2>
            <p className="text-muted-foreground mt-1">
              {isReimport 
                ? 'Collez le nouveau texte pour mettre à jour la startlist' 
                : 'Importez la startlist par texte ou fichier'
              }
            </p>
          </div>
        </div>

        {isReimport ? (
          // Mode réimport : une seule carte avec champs disabled
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Import par texte
              </CardTitle>
              <CardDescription>
                Mise à jour de la startlist existante
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phase">Phase</Label>
                <Select value={selectedPhaseId} disabled>
                  <SelectTrigger id="phase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {phases?.map((phase) => (
                      <SelectItem key={phase.id} value={phase.id}>
                        Phase {phase.index_dans_saison} ({phase.date_debut} - {phase.date_fin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="race">Course</Label>
                <Select value={selectedRaceId} disabled>
                  <SelectTrigger id="race">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.nom} ({course.date_debut})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note du startlisteur (optionnel)</Label>
                <Input
                  id="note"
                  value={startlisteurNote}
                  onChange={(e) => setStartlisteurNote(e.target.value)}
                  placeholder="Ex: Startlist mise à jour"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="text">Texte de la startlist *</Label>
                <Textarea
                  id="text"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Collez ici le nouveau texte de la startlist..."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <Button 
                onClick={handleParse} 
                disabled={isLoading || !textContent.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing en cours...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Mettre à jour la startlist
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Mode initial : deux cartes (texte + fichier)
          <div className="grid gap-6 md:grid-cols-2">
        {/* Text Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import par texte
            </CardTitle>
            <CardDescription>
              Collez le texte de la startlist pour parsing automatique
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phase">Phase *</Label>
              <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
                <SelectTrigger id="phase">
                  <SelectValue placeholder="Sélectionner une phase" />
                </SelectTrigger>
                <SelectContent>
                  {phases?.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      Phase {phase.index_dans_saison} ({phase.date_debut} - {phase.date_fin})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPhaseId && (
              <div className="space-y-2">
                <Label htmlFor="race">Course *</Label>
                <Select value={selectedRaceId} onValueChange={setSelectedRaceId}>
                  <SelectTrigger id="race">
                    <SelectValue placeholder="Sélectionner une course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.nom} ({course.date_debut})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="note">Note du startlisteur (optionnel)</Label>
              <Input
                id="note"
                value={startlisteurNote}
                onChange={(e) => setStartlisteurNote(e.target.value)}
                placeholder="Ex: Startlist provisoire"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text">Texte de la startlist *</Label>
              <Textarea
                id="text"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Collez ici le texte de la startlist..."
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <Button 
              onClick={handleParse} 
              disabled={isLoading || !textContent.trim() || !selectedPhaseId || !selectedRaceId || selectedRaceId === 'all'}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Parsing en cours...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Parser la startlist
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import par fichier
            </CardTitle>
            <CardDescription>
              Uploadez un fichier PDF ou TXT de startlist
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phase-file">Phase *</Label>
              <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
                <SelectTrigger id="phase-file">
                  <SelectValue placeholder="Sélectionner une phase" />
                </SelectTrigger>
                <SelectContent>
                  {phases?.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      Phase {phase.index_dans_saison} ({phase.date_debut} - {phase.date_fin})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPhaseId && (
              <div className="space-y-2">
                <Label htmlFor="race-file">Course *</Label>
                <Select value={selectedRaceId} onValueChange={setSelectedRaceId}>
                  <SelectTrigger id="race-file">
                    <SelectValue placeholder="Sélectionner une course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.nom} ({course.date_debut})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label 
                htmlFor="file-upload" 
                className="cursor-pointer text-sm font-medium text-primary hover:underline"
              >
                Cliquez pour sélectionner un fichier
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileUpload}
                disabled={isLoading || !selectedPhaseId || !selectedRaceId || selectedRaceId === 'all'}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground mt-2">
                PDF ou TXT uniquement
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Fonctionnalités :</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Matching automatique avec la base de données</li>
                <li>• Gestion des coureurs non trouvés</li>
                <li>• Export CSV des résultats</li>
                <li>• Validation PCS par les managers</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        </div>
        )}
      </div>
    );
  }

  // Mode "detail" : afficher la vue détaillée de la startlist
  if (viewMode === 'detail' && selectedStartlistId) {
    return (
      <StartlistDetailView
        startlistId={selectedStartlistId}
        onBack={() => {
          setViewMode('list');
          setSelectedStartlistId(null);
          setSelectedRace(null);
        }}
        isSuperAdmin={true}
        onImport={() => {
          if (selectedRace) {
            setSelectedPhaseId(selectedRace.phase_id);
            setSelectedRaceId(selectedRace.id);
            setIsReimport(true);
            setViewMode('import');
          }
        }}
      />
    );
  }

  return null;
};

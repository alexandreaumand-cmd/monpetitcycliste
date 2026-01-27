import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, CheckCircle2, ImageIcon, AlertCircle } from "lucide-react";
import { RouteImageUploader } from "@/components/startlist/RouteImageUploader";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StartlistRaceCards } from "./StartlistRaceCards";
import { StartlistDetailView } from "./StartlistDetailView";
import { StartlistReviewUnmatched } from "./StartlistReviewUnmatched";

type ViewMode = 'list' | 'import' | 'detail' | 'review';

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
  const [importedStartlistId, setImportedStartlistId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pcsValidated, setPcsValidated] = useState(false);
  const [importCounts, setImportCounts] = useState<{ total: number; confirmed: number; unmatched: number } | null>(null);

  // Load current user on mount
  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: manager } = await supabase
        .from('managers')
        .select('id, nom')
        .eq('user_id', user.id)
        .single();
      setCurrentUser(manager);
    }
  };

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

  // Load current user on component mount
  useState(() => {
    loadCurrentUser();
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
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', user.user.id)
        .single();

      if (!manager) {
        toast.error("Manager introuvable");
        return;
      }

      const { data, error } = await supabase.functions.invoke('startlist-import', {
        body: { 
          race_id: selectedRaceId,
          created_by_manager_id: manager.id,
          raw_text: textContent,
          note: startlisteurNote.trim() || null
        }
      });

      if (error) throw error;

      // Capture the startlist_id and counts from the response
      if (data.startlist_id) {
        setImportedStartlistId(data.startlist_id);
        setPcsValidated(false);
        setImportCounts(data.counts);
      }

      queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
      
      toast.success(
        `Startlist importée : ${data.counts.confirmed} coureurs confirmés, ${data.counts.unmatched} à traiter`
      );
      
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

  const handlePcsValidation = async () => {
    if (!importedStartlistId || !currentUser) return;
    
    try {
      const newStatus = !pcsValidated;
      
      const { error } = await supabase
        .from('startlist_imports')
        .update({ 
          pcs_validated: newStatus,
          pcs_validated_at: newStatus ? new Date().toISOString() : null,
          pcs_validated_by_manager_id: newStatus ? currentUser.id : null
        })
        .eq('id', importedStartlistId);

      if (error) throw error;

      setPcsValidated(newStatus);
      toast.success(newStatus ? "SL validée ✓" : "Validation retirée");
      queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
    } catch (error: any) {
      toast.error("Erreur : " + error.message);
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
              setImportedStartlistId(null);
              setPcsValidated(false);
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

            {/* Résultats de l'import */}
            {importedStartlistId && importCounts && (
              <Card className="mt-4 border-green-200 bg-green-50">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">✅ Coureurs confirmés</span>
                      <Badge variant="secondary">{importCounts.confirmed}</Badge>
                    </div>
                    {importCounts.unmatched > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">⚠️ Coureurs à traiter</span>
                          <Badge variant="secondary">{importCounts.unmatched}</Badge>
                        </div>
                        <Button 
                          onClick={() => setViewMode('review')}
                          variant="default"
                          className="w-full"
                        >
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Réviser les non-matchés
                        </Button>
                      </>
                    )}
                    <div className="flex gap-2 pt-2 border-t">
                      {selectedRaceId && selectedRaceId !== 'all' && (
                        <RouteImageUploader
                          raceId={selectedRaceId}
                          currentImageUrl={null}
                          onUploadComplete={() => {
                            queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
                            toast.success("Image du parcours uploadée !");
                          }}
                        />
                      )}
                      <Button 
                        onClick={handlePcsValidation} 
                        variant="default" 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {pcsValidated ? "Retirer validation PCS" : "Valider PCS"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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

  // Mode "review" : réviser les non-matchés
  if (viewMode === 'review' && importedStartlistId) {
    return (
      <StartlistReviewUnmatched
        startlistId={importedStartlistId}
        onBack={() => setViewMode('import')}
        onComplete={() => {
          setViewMode('list');
          setSelectedRace(null);
          setSelectedPhaseId("");
          setSelectedRaceId("all");
          setTextContent("");
          setStartlisteurNote("");
          setIsReimport(false);
          setImportedStartlistId(null);
          setImportCounts(null);
        }}
      />
    );
  }

  return null;
};

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, MessageSquare, ArrowLeft } from "lucide-react";
import { useLeagueSeason } from "@/hooks/useLeagueSeason";
import { useLeague } from "@/contexts/LeagueContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StartlistRaceCards } from "./StartlistRaceCards";
import { StartlistDetailView } from "./StartlistDetailView";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type ViewMode = 'list' | 'import' | 'detail';

export const StartlistImportManager = () => {
  const { leagueId } = useLeague();
  const { phases } = useLeagueSeason();
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedStartlistId, setSelectedStartlistId] = useState<string | null>(null);
  const [selectedRace, setSelectedRace] = useState<any>(null);
  
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [selectedRaceId, setSelectedRaceId] = useState<string>("all");
  const [textContent, setTextContent] = useState<string>("");
  const [startlisteurNote, setStartlisteurNote] = useState<string>("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
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

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('startlist-parse-text', {
        body: { 
          race_id: selectedRaceId && selectedRaceId !== 'all' ? selectedRaceId : null,
          phase_id: selectedPhaseId,
          league_id: leagueId,
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
      
    } catch (error: any) {
      console.error('Parse error:', error);
      toast.error("Erreur lors du parsing: " + error.message);
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

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('phase_id', selectedPhaseId);
      if (selectedRaceId && selectedRaceId !== 'all') formData.append('race_id', selectedRaceId);
      if (leagueId) formData.append('league_id', leagueId);

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
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Erreur lors de l'upload: " + error.message);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const handleEditStartlist = (race: any, phaseId: string, raceId: string) => {
    setSelectedRace(race);
    setSelectedPhaseId(phaseId);
    setSelectedRaceId(raceId);
    setViewMode('import');
    setSelectedStartlistId(null);
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

  // Mode "import" : afficher le formulaire simplifié
  if (viewMode === 'import') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Header avec titre de la course */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => {
              setViewMode('list');
              setSelectedRace(null);
              setSelectedPhaseId("");
              setSelectedRaceId("all");
              setTextContent("");
              setStartlisteurNote("");
              setShowDiagnostics(false);
            }}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la liste
          </Button>
          <h1 className="text-3xl font-bold">
            {selectedRace?.nom || "Course"}
          </h1>
          {selectedRace?.date_debut && (
            <p className="text-muted-foreground mt-1">
              {format(new Date(selectedRace.date_debut), "dd MMMM yyyy", { locale: fr })}
            </p>
          )}
        </div>

        {/* Carte d'import - Design simplifié */}
        <Card>
          <CardHeader>
            <CardTitle>Coller le texte de la startlist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selects Phase et Course */}
            <div className="grid grid-cols-2 gap-4">
              {/* Course (optionnel) */}
              <div className="space-y-2">
                <Label htmlFor="course">Course (optionnel)</Label>
                <Input
                  id="course"
                  value={selectedRace?.nom || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              {/* Phase */}
              <div className="space-y-2">
                <Label htmlFor="phase">Phase</Label>
                <Select value={selectedPhaseId} disabled>
                  <SelectTrigger id="phase" className="bg-muted">
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
            </div>

            {/* Textarea pour le texte */}
            <div className="space-y-2">
              <Label htmlFor="text">
                Texte (format: rang. CODE NOM Prénom temps)
              </Label>
              <Textarea
                id="text"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="0. MBH NESPOLI Lorenzo 0:00&#10;0. UAD LAENGEN Vegard Stake 0:00&#10;0. JAY DE MARCHI Alessandro 0:00"
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            {/* Input note du startlisteur */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <Label htmlFor="note">Le mot du startlisteur (optionnel)</Label>
              </div>
              <Input
                id="note"
                value={startlisteurNote}
                onChange={(e) => setStartlisteurNote(e.target.value)}
                placeholder="Ajoutez un commentaire sur cette startlist..."
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {startlisteurNote.length} / 500 caractères
              </p>
            </div>

            {/* Switch diagnostics (admin only) */}
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="diagnostics"
                  checked={showDiagnostics}
                  onCheckedChange={setShowDiagnostics}
                />
                <Label htmlFor="diagnostics">
                  Activer les diagnostics (admin)
                </Label>
              </div>
            )}

            {/* Bouton d'import */}
            <Button 
              onClick={handleParse}
              disabled={isLoading || !textContent.trim()}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Parsing en cours...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Identifier les coureurs
                </>
              )}
            </Button>
          </CardContent>
        </Card>
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
        }}
        onEdit={handleEditStartlist}
        isSuperAdmin={true}
      />
    );
  }

  return null;
};

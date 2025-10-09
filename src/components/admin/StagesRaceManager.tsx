import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertCircle, Calculator, Loader2, RotateCw, Undo2, Info } from "lucide-react";
import { toast } from "sonner";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";

interface ResultsData {
  course: {
    id: string;
    nom: string;
    categorie: string;
    nb_etapes: number;
    phase_id: string;
  };
  context: 'Etape' | 'General';
  required_top?: 10 | 15;
  stage?: { etape_numero: number };
  top10_base?: Array<{ position: number; coureur_id: string | null }>;
  leaders_base?: {
    general_leader_id: string | null;
    points_leader_id: string | null;
    montagne_leader_id: string | null;
  };
  jersey_holders_base?: {
    general_holder_id: string | null;
    vert_holder_id: string | null;
    montagne_holder_id: string | null;
    jeune_holder_id: string | null;
    combattif_holder_id: string | null;
  };
  is_stage_complete?: boolean;
  general_top_base?: Array<{ position: number; coureur_id: string | null }>;
  jersey_winners_base?: {
    general_winner_id?: string | null;
    points_winner_id?: string | null;
    montagne_winner_id?: string | null;
    jeune_winner_id?: string | null;
  };
  stages_status?: Array<{ etape_numero: number; has_top10: boolean; has_leaders: boolean }>;
  all_stages_complete_for_cg?: boolean;
}

export function StagesRaceManager() {
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [context, setContext] = useState<'Etape' | 'General'>('Etape');
  const [etapeNumero, setEtapeNumero] = useState<number>(1);
  const queryClient = useQueryClient();

  // Fetch courses of type 'stage' (includes "Stage race" and variations)
  const { data: courses } = useQuery({
    queryKey: ["courses-with-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, categorie, date_debut, date_fin, phase_id")
        .eq("type_course", "stage")
        .order("date_debut", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch number of stages for selected course
  const { data: nbEtapesData } = useQuery({
    queryKey: ["course-nb-etapes", selectedCourse],
    queryFn: async () => {
      if (!selectedCourse) return 0;

      // Try to get from race_results first
      const { data: resultData, error: resultError } = await supabase
        .from("race_results")
        .select("etape_numero")
        .eq("course_id", selectedCourse)
        .eq("type_classement", "Etape")
        .not("etape_numero", "is", null);

      if (!resultError && resultData && resultData.length > 0) {
        return Math.max(...resultData.map(s => s.etape_numero));
      }

      // Fallback: estimate from course dates (date_fin - date_debut + 1)
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("date_debut, date_fin")
        .eq("id", selectedCourse)
        .single();

      if (courseError || !courseData) return 0;

      const debut = new Date(courseData.date_debut);
      const fin = new Date(courseData.date_fin);
      const diffTime = Math.abs(fin.getTime() - debut.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      return diffDays;
    },
    enabled: !!selectedCourse,
  });

  // Load results data
  const { data: resultsData, isLoading: resultsLoading, refetch: refetchResults } = useQuery({
    queryKey: ["admin-results-load", selectedCourse, context, etapeNumero],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-results-load", {
        body: { 
          course_id: selectedCourse,
          context,
          etape_numero: context === 'Etape' ? etapeNumero : null
        },
      });

      if (error) throw error;
      return data as ResultsData;
    },
    enabled: !!selectedCourse,
  });

  // Compute points mutation
  const computePointsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("compute-points", {
        body: { course_id: selectedCourse },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Points recalculés avec succès");
      refetchResults();
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const courseInfo = courses?.find(c => c.id === selectedCourse);
  const phaseId = courseInfo?.phase_id || resultsData?.course.phase_id;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestion des courses à étapes - Résultats</CardTitle>
          <CardDescription>
            Charger, saisir et corriger les résultats d'étapes et classement général
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Course</label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une course" />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom} — {new Date(c.date_debut).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Contexte</label>
              <Select value={context} onValueChange={(val) => setContext(val as 'Etape' | 'General')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Etape">Étape</SelectItem>
                  <SelectItem value="General">Classement Général (CG)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {context === 'Etape' && selectedCourse && (
              <div className="space-y-2">
                <label className="text-sm font-medium">N° Étape</label>
                {nbEtapesData && nbEtapesData > 0 ? (
                  <Select value={String(etapeNumero)} onValueChange={(val) => setEtapeNumero(Number(val))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: nbEtapesData }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Étape {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Alert variant="default">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Nombre d'étapes estimé depuis les dates de course. Ajustez manuellement si nécessaire.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {selectedCourse && (
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => refetchResults()}
                disabled={resultsLoading}
                variant="outline"
                size="sm"
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Recharger
              </Button>
              <Button
                onClick={() => computePointsMutation.mutate()}
                disabled={computePointsMutation.isPending}
                variant="outline"
                size="sm"
              >
                {computePointsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4 mr-2" />
                )}
                Recalculer les points
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCourse && resultsData && phaseId && (
        context === 'Etape' ? (
          <StageEditor
            resultsData={resultsData}
            phaseId={phaseId}
            onSuccess={() => {
              refetchResults();
              toast.success(`Étape ${etapeNumero} enregistrée`);
            }}
          />
        ) : (
          <GCEditor
            resultsData={resultsData}
            phaseId={phaseId}
            onSuccess={() => {
              refetchResults();
              toast.success("Classement général enregistré");
            }}
          />
        )
      )}
    </div>
  );
}

// Stage Editor Component with auto-load and diff tracking
function StageEditor({
  resultsData,
  phaseId,
  onSuccess,
}: {
  resultsData: ResultsData;
  phaseId: string;
  onSuccess: () => void;
}) {
  // Base values (from DB)
  const top10Base = resultsData.top10_base || [];
  const leadersBase = resultsData.leaders_base || {
    general_leader_id: null,
    points_leader_id: null,
    montagne_leader_id: null
  };
  const jerseyHoldersBase = resultsData.jersey_holders_base || {
    general_holder_id: null,
    vert_holder_id: null,
    montagne_holder_id: null,
    jeune_holder_id: null,
    combattif_holder_id: null
  };

  // Editable values
  const [top10Edit, setTop10Edit] = useState<Array<{ position: number; coureur_id: string | null }>>(top10Base);
  const [generalLeaderEdit, setGeneralLeaderEdit] = useState(leadersBase.general_leader_id || "");
  const [pointsLeaderEdit, setPointsLeaderEdit] = useState(leadersBase.points_leader_id || "");
  const [montagneLeaderEdit, setMontagneLeaderEdit] = useState(leadersBase.montagne_leader_id || "");
  
  const [generalHolderEdit, setGeneralHolderEdit] = useState(jerseyHoldersBase.general_holder_id || "");
  const [vertHolderEdit, setVertHolderEdit] = useState(jerseyHoldersBase.vert_holder_id || "");
  const [montagneHolderEdit, setMontagneHolderEdit] = useState(jerseyHoldersBase.montagne_holder_id || "");
  const [jeuneHolderEdit, setJeuneHolderEdit] = useState(jerseyHoldersBase.jeune_holder_id || "");
  const [combattifHolderEdit, setCombattifHolderEdit] = useState(jerseyHoldersBase.combattif_holder_id || "");

  // Update edit states when base data changes
  useEffect(() => {
    setTop10Edit(top10Base);
    setGeneralLeaderEdit(leadersBase.general_leader_id || "");
    setPointsLeaderEdit(leadersBase.points_leader_id || "");
    setMontagneLeaderEdit(leadersBase.montagne_leader_id || "");
    setGeneralHolderEdit(jerseyHoldersBase.general_holder_id || "");
    setVertHolderEdit(jerseyHoldersBase.vert_holder_id || "");
    setMontagneHolderEdit(jerseyHoldersBase.montagne_holder_id || "");
    setJeuneHolderEdit(jerseyHoldersBase.jeune_holder_id || "");
    setCombattifHolderEdit(jerseyHoldersBase.combattif_holder_id || "");
  }, [resultsData]);

  // Count changes
  const changesCount = 
    top10Edit.filter((t, i) => t.coureur_id !== top10Base[i]?.coureur_id).length +
    (generalLeaderEdit !== (leadersBase.general_leader_id || "") ? 1 : 0) +
    (pointsLeaderEdit !== (leadersBase.points_leader_id || "") ? 1 : 0) +
    (montagneLeaderEdit !== (leadersBase.montagne_leader_id || "") ? 1 : 0) +
    (generalHolderEdit !== (jerseyHoldersBase.general_holder_id || "") ? 1 : 0) +
    (vertHolderEdit !== (jerseyHoldersBase.vert_holder_id || "") ? 1 : 0) +
    (montagneHolderEdit !== (jerseyHoldersBase.montagne_holder_id || "") ? 1 : 0) +
    (jeuneHolderEdit !== (jerseyHoldersBase.jeune_holder_id || "") ? 1 : 0) +
    (combattifHolderEdit !== (jerseyHoldersBase.combattif_holder_id || "") ? 1 : 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Build top10 array
      const top10Data = top10Edit.map(t => ({
        position: t.position,
        coureur_id: t.coureur_id || "",
      }));

      // Validate all positions filled
      if (top10Data.some(t => !t.coureur_id)) {
        throw new Error("Toutes les positions du Top 10 doivent être remplies");
      }

      // Check duplicates
      const ids = top10Data.map(t => t.coureur_id);
      if (new Set(ids).size !== ids.length) {
        throw new Error("Un coureur ne peut pas apparaître deux fois dans le Top 10");
      }

      if (!generalLeaderEdit || !pointsLeaderEdit || !montagneLeaderEdit) {
        throw new Error("Les trois porteurs de maillots après étape sont requis");
      }

      const jerseyHolders: any = {};
      if (generalHolderEdit) jerseyHolders.general_holder_id = generalHolderEdit;
      if (vertHolderEdit) jerseyHolders.vert_holder_id = vertHolderEdit;
      if (montagneHolderEdit) jerseyHolders.montagne_holder_id = montagneHolderEdit;
      if (jeuneHolderEdit) jerseyHolders.jeune_holder_id = jeuneHolderEdit;
      if (combattifHolderEdit) jerseyHolders.combattif_holder_id = combattifHolderEdit;

      const { data, error } = await supabase.functions.invoke("admin-stage-save-step", {
        body: {
          course_id: resultsData.course.id,
          etape_numero: resultsData.stage!.etape_numero,
          top10: top10Data,
          leaders: {
            general_leader_id: generalLeaderEdit,
            points_leader_id: pointsLeaderEdit,
            montagne_leader_id: montagneLeaderEdit,
          },
          jersey_holders: jerseyHolders,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess,
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleTop10Change = (position: number, coureurId: string | null) => {
    setTop10Edit(prev => prev.map(t => 
      t.position === position ? { ...t, coureur_id: coureurId } : t
    ));
  };

  const handleCancelAll = () => {
    setTop10Edit(top10Base);
    setGeneralLeaderEdit(leadersBase.general_leader_id || "");
    setPointsLeaderEdit(leadersBase.points_leader_id || "");
    setMontagneLeaderEdit(leadersBase.montagne_leader_id || "");
    setGeneralHolderEdit(jerseyHoldersBase.general_holder_id || "");
    setVertHolderEdit(jerseyHoldersBase.vert_holder_id || "");
    setMontagneHolderEdit(jerseyHoldersBase.montagne_holder_id || "");
    setJeuneHolderEdit(jerseyHoldersBase.jeune_holder_id || "");
    setCombattifHolderEdit(jerseyHoldersBase.combattif_holder_id || "");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Étape {resultsData.stage?.etape_numero}</CardTitle>
            <CardDescription>Top 10 + Porteurs de maillots après l'étape</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {resultsData.is_stage_complete ? (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Complet
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Incomplet
              </Badge>
            )}
            {changesCount > 0 && (
              <Badge variant="destructive">
                {changesCount} modification{changesCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-3">Top 10 de l'étape</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {top10Edit.map((item) => {
              const isChanged = item.coureur_id !== top10Base.find(b => b.position === item.position)?.coureur_id;
              return (
                <div key={item.position} className={`flex items-center gap-3 p-2 rounded ${isChanged ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
                  <Badge variant="outline" className="w-8 justify-center shrink-0">
                    {item.position}
                  </Badge>
                  <CoureursCombobox
                    phaseId={phaseId}
                    value={item.coureur_id}
                    onSelect={(coureur) => handleTop10Change(item.position, coureur?.coureur_id || null)}
                    placeholder={`${item.position}${item.position === 1 ? "er" : "e"} position`}
                    showTakenRiders={true}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3">Leaders provisoires après l'étape</h3>
          <div className="space-y-3">
            <div className={`space-y-2 p-2 rounded ${generalLeaderEdit !== (leadersBase.general_leader_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
              <label className="text-sm font-medium">Leader Général (provisoire)</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={generalLeaderEdit || null}
                onSelect={(coureur) => setGeneralLeaderEdit(coureur?.coureur_id || "")}
                placeholder="Sélectionner le leader général"
                showTakenRiders={true}
              />
            </div>
            <div className={`space-y-2 p-2 rounded ${pointsLeaderEdit !== (leadersBase.points_leader_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
              <label className="text-sm font-medium">Leader Points (provisoire)</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={pointsLeaderEdit || null}
                onSelect={(coureur) => setPointsLeaderEdit(coureur?.coureur_id || "")}
                placeholder="Sélectionner le leader points"
                showTakenRiders={true}
              />
            </div>
            <div className={`space-y-2 p-2 rounded ${montagneLeaderEdit !== (leadersBase.montagne_leader_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
              <label className="text-sm font-medium">Leader Montagne (provisoire)</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={montagneLeaderEdit || null}
                onSelect={(coureur) => setMontagneLeaderEdit(coureur?.coureur_id || "")}
                placeholder="Sélectionner le leader montagne"
                showTakenRiders={true}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3">Porteurs de maillots (optionnel)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className={`space-y-2 p-3 rounded border ${generalHolderEdit !== (jerseyHoldersBase.general_holder_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400' : 'border-border'}`}>
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="text-lg">🟡</span>
                Maillot Jaune
              </label>
              <CoureursCombobox
                phaseId={phaseId}
                value={generalHolderEdit || null}
                onSelect={(coureur) => setGeneralHolderEdit(coureur?.coureur_id || "")}
                placeholder="Leader général"
                showTakenRiders={true}
              />
            </div>
            <div className={`space-y-2 p-3 rounded border ${vertHolderEdit !== (jerseyHoldersBase.vert_holder_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400' : 'border-border'}`}>
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="text-lg">🟢</span>
                Maillot Vert
              </label>
              <CoureursCombobox
                phaseId={phaseId}
                value={vertHolderEdit || null}
                onSelect={(coureur) => setVertHolderEdit(coureur?.coureur_id || "")}
                placeholder="Classement points"
                showTakenRiders={true}
              />
            </div>
            <div className={`space-y-2 p-3 rounded border ${montagneHolderEdit !== (jerseyHoldersBase.montagne_holder_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400' : 'border-border'}`}>
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="text-lg">🔴</span>
                Maillot à Pois
              </label>
              <CoureursCombobox
                phaseId={phaseId}
                value={montagneHolderEdit || null}
                onSelect={(coureur) => setMontagneHolderEdit(coureur?.coureur_id || "")}
                placeholder="Classement montagne"
                showTakenRiders={true}
              />
            </div>
            <div className={`space-y-2 p-3 rounded border ${jeuneHolderEdit !== (jerseyHoldersBase.jeune_holder_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400' : 'border-border'}`}>
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="text-lg">⚪</span>
                Maillot Blanc
              </label>
              <CoureursCombobox
                phaseId={phaseId}
                value={jeuneHolderEdit || null}
                onSelect={(coureur) => setJeuneHolderEdit(coureur?.coureur_id || "")}
                placeholder="Meilleur jeune"
                showTakenRiders={true}
              />
            </div>
            <div className={`space-y-2 p-3 rounded border ${combattifHolderEdit !== (jerseyHoldersBase.combattif_holder_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400' : 'border-border'}`}>
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="text-lg">🔵</span>
                Maillot Combattif
              </label>
              <CoureursCombobox
                phaseId={phaseId}
                value={combattifHolderEdit || null}
                onSelect={(coureur) => setCombattifHolderEdit(coureur?.coureur_id || "")}
                placeholder="Plus combattif"
                showTakenRiders={true}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-between sticky bottom-0 bg-background pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancelAll}
            disabled={changesCount === 0}
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Annuler tout
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || changesCount === 0}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer {changesCount > 0 && `(${changesCount})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// GC Editor Component with auto-load and diff tracking
function GCEditor({
  resultsData,
  phaseId,
  onSuccess,
}: {
  resultsData: ResultsData;
  phaseId: string;
  onSuccess: () => void;
}) {
  const requiredTop = resultsData.required_top || 10;
  const generalTopBase = resultsData.general_top_base || [];
  const jerseyWinnersBase = resultsData.jersey_winners_base || {
    general_winner_id: null,
    points_winner_id: null,
    montagne_winner_id: null,
    jeune_winner_id: null
  };
  const allStagesComplete = resultsData.all_stages_complete_for_cg || false;
  const stagesStatus = resultsData.stages_status || [];

  // Editable values
  const [generalTopEdit, setGeneralTopEdit] = useState<Array<{ position: number; coureur_id: string | null }>>(generalTopBase);
  const [generalWinnerEdit, setGeneralWinnerEdit] = useState(jerseyWinnersBase.general_winner_id || "");
  const [pointsWinnerEdit, setPointsWinnerEdit] = useState(jerseyWinnersBase.points_winner_id || "");
  const [montagneWinnerEdit, setMontagneWinnerEdit] = useState(jerseyWinnersBase.montagne_winner_id || "");
  const [jeuneWinnerEdit, setJeuneWinnerEdit] = useState(jerseyWinnersBase.jeune_winner_id || "");

  // Update edit states when base data changes
  useEffect(() => {
    setGeneralTopEdit(generalTopBase);
    setGeneralWinnerEdit(jerseyWinnersBase.general_winner_id || "");
    setPointsWinnerEdit(jerseyWinnersBase.points_winner_id || "");
    setMontagneWinnerEdit(jerseyWinnersBase.montagne_winner_id || "");
    setJeuneWinnerEdit(jerseyWinnersBase.jeune_winner_id || "");
  }, [resultsData]);

  // Count changes
  const changesCount = 
    generalTopEdit.filter((t, i) => t.coureur_id !== generalTopBase[i]?.coureur_id).length +
    (generalWinnerEdit !== (jerseyWinnersBase.general_winner_id || "") ? 1 : 0) +
    (pointsWinnerEdit !== (jerseyWinnersBase.points_winner_id || "") ? 1 : 0) +
    (montagneWinnerEdit !== (jerseyWinnersBase.montagne_winner_id || "") ? 1 : 0) +
    (jeuneWinnerEdit !== (jerseyWinnersBase.jeune_winner_id || "") ? 1 : 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const generalTopData = generalTopEdit.map(t => ({
        position: t.position,
        coureur_id: t.coureur_id || "",
      }));

      if (generalTopData.some(t => !t.coureur_id)) {
        throw new Error(`Toutes les positions du Top ${requiredTop} doivent être remplies`);
      }

      const ids = generalTopData.map(t => t.coureur_id);
      if (new Set(ids).size !== ids.length) {
        throw new Error("Un coureur ne peut pas apparaître deux fois dans le classement");
      }

      if (!generalWinnerEdit) {
        throw new Error("Le vainqueur général est requis");
      }

      const jerseyWinners: any = {
        general_winner_id: generalWinnerEdit,
      };

      if (pointsWinnerEdit) jerseyWinners.points_winner_id = pointsWinnerEdit;
      if (montagneWinnerEdit) jerseyWinners.montagne_winner_id = montagneWinnerEdit;
      if (jeuneWinnerEdit) jerseyWinners.jeune_winner_id = jeuneWinnerEdit;

      const { data, error } = await supabase.functions.invoke("admin-gc-save", {
        body: {
          course_id: resultsData.course.id,
          general_top: generalTopData,
          jersey_winners: jerseyWinners,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess,
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleGeneralTopChange = (position: number, coureurId: string | null) => {
    setGeneralTopEdit(prev => prev.map(t => 
      t.position === position ? { ...t, coureur_id: coureurId } : t
    ));
  };

  const handleCancelAll = () => {
    setGeneralTopEdit(generalTopBase);
    setGeneralWinnerEdit(jerseyWinnersBase.general_winner_id || "");
    setPointsWinnerEdit(jerseyWinnersBase.points_winner_id || "");
    setMontagneWinnerEdit(jerseyWinnersBase.montagne_winner_id || "");
    setJeuneWinnerEdit(jerseyWinnersBase.jeune_winner_id || "");
  };

  if (!allStagesComplete) {
    const incompleteStages = stagesStatus
      .filter(s => !s.has_top10 || !s.has_leaders)
      .map(s => `#${s.etape_numero}`)
      .join(", ");

    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Terminez d'abord toutes les étapes (Top 10 + porteurs à chaque étape).
          <br />
          Étapes incomplètes : {incompleteStages}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Classement Général Final</CardTitle>
            <CardDescription>
              Cette course requiert Top {requiredTop} en CG
            </CardDescription>
          </div>
          {changesCount > 0 && (
            <Badge variant="destructive">
              {changesCount} modification{changesCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-3">Top {requiredTop} du Classement Général</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {generalTopEdit.map((item) => {
              const isChanged = item.coureur_id !== generalTopBase.find(b => b.position === item.position)?.coureur_id;
              return (
                <div key={item.position} className={`flex items-center gap-3 p-2 rounded ${isChanged ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
                  <Badge variant="outline" className="w-8 justify-center shrink-0">
                    {item.position}
                  </Badge>
                  <CoureursCombobox
                    phaseId={phaseId}
                    value={item.coureur_id}
                    onSelect={(coureur) => handleGeneralTopChange(item.position, coureur?.coureur_id || null)}
                    placeholder={`${item.position}${item.position === 1 ? "er" : "e"} position`}
                    showTakenRiders={true}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3">Vainqueurs des Maillots</h3>
          <div className="space-y-3">
            <div className={`space-y-2 p-2 rounded ${generalWinnerEdit !== (jerseyWinnersBase.general_winner_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
              <label className="text-sm font-medium">Vainqueur Général (obligatoire)</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={generalWinnerEdit || null}
                onSelect={(coureur) => setGeneralWinnerEdit(coureur?.coureur_id || "")}
                placeholder="Sélectionner le vainqueur général"
                showTakenRiders={true}
              />
            </div>

            <div className={`space-y-2 p-2 rounded ${pointsWinnerEdit !== (jerseyWinnersBase.points_winner_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
              <label className="text-sm font-medium">Vainqueur Classement par Points</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={pointsWinnerEdit || null}
                onSelect={(coureur) => setPointsWinnerEdit(coureur?.coureur_id || "")}
                placeholder="Sélectionner le vainqueur du classement par points"
                showTakenRiders={true}
              />
            </div>

            <div className={`space-y-2 p-2 rounded ${montagneWinnerEdit !== (jerseyWinnersBase.montagne_winner_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
              <label className="text-sm font-medium">Vainqueur Classement de la Montagne</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={montagneWinnerEdit || null}
                onSelect={(coureur) => setMontagneWinnerEdit(coureur?.coureur_id || "")}
                placeholder="Sélectionner le vainqueur du classement de la montagne"
                showTakenRiders={true}
              />
            </div>

            <div className={`space-y-2 p-2 rounded ${jeuneWinnerEdit !== (jerseyWinnersBase.jeune_winner_id || "") ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}`}>
              <label className="text-sm font-medium">Vainqueur Classement des Jeunes</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={jeuneWinnerEdit || null}
                onSelect={(coureur) => setJeuneWinnerEdit(coureur?.coureur_id || "")}
                placeholder="Sélectionner le vainqueur du classement des jeunes"
                showTakenRiders={true}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-between sticky bottom-0 bg-background pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancelAll}
            disabled={changesCount === 0}
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Annuler tout
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || changesCount === 0}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer le CG {changesCount > 0 && `(${changesCount})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

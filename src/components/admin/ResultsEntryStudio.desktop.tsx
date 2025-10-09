import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { X, CheckCircle2, Info, ChevronLeft, ChevronRight, Circle, CheckCircle, Save, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";
import { JerseyHoldersInput } from "@/components/admin/JerseyHoldersInput";
import { cn } from "@/lib/utils";

type CourseData = {
  course_id: string;
  course_nom: string;
  categorie: string;
  type_course: "One day" | "Stage race";
  date_debut: string;
  date_fin: string;
  nb_etapes: number;
  phase_id: string;
};

type ClassementType = "Etape" | "General" | "Points" | "Montagne" | "Jeune" | "Combatif" | "Porteur Général" | "Porteur Vert" | "Porteur Montagne" | "Porteur Jeune" | "Porteur Combattif";
type ResultStatut = "finished" | "dnf" | "dns" | "dsq";
type JerseyType = 'general' | 'vert' | 'montagne' | 'jeune' | 'combattif';

type JerseyHolders = {
  general: string | null;
  vert: string | null;
  montagne: string | null;
  jeune: string | null;
  combattif: string | null;
};

type ResultRow = {
  position: number;
  coureur_id: string | null;
  coureur_nom: string | null;
  manager_nom: string | null;
  statut: ResultStatut;
  points: number;
  grid_version?: string;
};

type StudioProps = {
  course: CourseData;
  mode: 'create' | 'edit';
  onClose: () => void;
};

export const ResultsEntryStudio = ({ course, mode, onClose }: StudioProps) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"stages" | "finals">("stages");
  const [currentStage, setCurrentStage] = useState(1);
  const [currentFinalClassement, setCurrentFinalClassement] = useState<ClassementType>("General");
  const [dateClassement, setDateClassement] = useState("");
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [gridPrepared, setGridPrepared] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const requestIdRef = useRef(0);
  const [currentRequestId, setCurrentRequestId] = useState(0);
  const [jerseyHolders, setJerseyHolders] = useState<JerseyHolders>({
    general: null,
    vert: null,
    montagne: null,
    jeune: null,
    combattif: null,
  });
  const [isCancelled, setIsCancelled] = useState(false);
  const [combatifWinner, setCombatifWinner] = useState<string | null>(null);

  const isOneDay = course.type_course === "One day";
  const classementType: ClassementType = isOneDay
    ? "General"
    : activeTab === "stages"
    ? "Etape"
    : currentFinalClassement;
  const etapeNumero = activeTab === "stages" && !isOneDay ? currentStage : null;

  const sel_key = `${course.course_id}|${classementType}|${etapeNumero ?? 0}`;

  const { data: scoringRules, isLoading: isScoringRulesLoading, error: scoringRulesError } = useQuery({
    queryKey: ["scoringRules", course.phase_id, classementType],
    queryFn: async () => {
      if (!course.phase_id) return [];

      const { data, error } = await supabase
        .from("scoring_rules")
        .select("*")
        .eq("saison_id", course.phase_id)
        .eq("type_classement", classementType);

      if (error) throw error;
      return data;
    },
  });

  const { data: stageCompletion, isLoading: isStageCompletionLoading, error: stageCompletionError } = useQuery({
    queryKey: ["stageCompletion", course.course_id, etapeNumero],
    queryFn: async () => {
      if (!course.course_id || !etapeNumero) return null;

      const { data, error } = await supabase
        .from("stage_completion")
        .select("*")
        .eq("course_id", course.course_id)
        .eq("etape_numero", etapeNumero)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: activeTab === "stages" && !isOneDay,
  });

  // Reset state when sel_key changes
  useEffect(() => {
    setResultRows([]);
    setGridPrepared(false);
    setIsDirty(false);
    setIsCancelled(false);
    setJerseyHolders({
      general: null,
      vert: null,
      montagne: null,
      jeune: null,
      combattif: null,
    });
    setCombatifWinner(null);

    // Auto-set date
    if (activeTab === "stages" && etapeNumero) {
      const stageDate = new Date(course.date_debut);
      stageDate.setDate(stageDate.getDate() + etapeNumero - 1);
      setDateClassement(format(stageDate, "yyyy-MM-dd"));
    } else {
      setDateClassement(course.date_fin);
    }
  }, [sel_key, activeTab, etapeNumero, course.date_debut, course.date_fin]);

  // Auto-prepare grid when scoring rules are loaded
  useEffect(() => {
    if (scoringRules && scoringRules.length > 0 && !gridPrepared) {
      handlePrepareGrid();
    }
  }, [scoringRules, gridPrepared]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        handleNext();
      } else if (event.key === "ArrowLeft") {
        handlePrevious();
      } else if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, currentStage, course.nb_etapes]);

  useEffect(() => {
    const warnBeforeClosing = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", warnBeforeClosing);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeClosing);
    };
  }, [isDirty]);

  const loadCombatifWinner = async () => {
    if (!course) return;

    try {
      const { data, error } = await supabase
        .from("race_results")
        .select("coureur_id")
        .eq("course_id", course.course_id)
        .eq("type_classement", "Combatif")
        .eq("position", 1)
        .maybeSingle();

      if (error) throw error;
      setCombatifWinner(data?.coureur_id || null);
    } catch (error) {
      console.error("Error loading combatif winner:", error);
    }
  };

  const handlePrepareGrid = async () => {
    const newRequestId = ++requestIdRef.current;
    setCurrentRequestId(newRequestId);

    let rows: ResultRow[] = [];

    if (mode === "edit") {
      try {
        let query = supabase
          .from("race_results")
          .select("position, coureur_id, coureurs(coureur_nom, manager_nom), statut, points, grid_version")
          .eq("course_id", course.course_id)
          .eq("type_classement", classementType);

        if (etapeNumero) {
          query = query.eq("etape_numero", etapeNumero);
        }

        const { data, error } = await query;

        if (error) throw error;

        rows = data.map((row) => ({
          position: row.position,
          coureur_id: row.coureur_id,
          coureur_nom: row.coureurs?.coureur_nom || null,
          manager_nom: row.coureurs?.manager_nom || null,
          statut: row.statut,
          points: row.points,
          grid_version: row.grid_version,
        }));
      } catch (error) {
        console.error("Error fetching existing results:", error);
        toast({
          title: "Error",
          description: "Failed to load existing results.",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Initialize with 15 empty rows
      rows = Array.from({ length: 15 }, (_, i) => ({
        position: i + 1,
        coureur_id: null,
        coureur_nom: null,
        manager_nom: null,
        statut: "finished" as ResultStatut,
        points: 0,
      }));
    }

    // Load Combatif winner if applicable
    if (currentFinalClassement === "Combatif") {
      await loadCombatifWinner();
    }

    if (newRequestId === currentRequestId) {
      setResultRows(rows);
      setGridPrepared(true);
      setIsDirty(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const etapeNumeroValue = classementType === "Etape" && etapeNumero ? Number(etapeNumero) : null;

      if (isCancelled) {
        return { success: false, message: "Save operation cancelled." };
      }

      // Prepare data for saving
      const resultsToSave = resultRows.map((row) => ({
        course_id: course.course_id,
        type_classement: classementType,
        etape_numero: etapeNumeroValue,
        position: row.position,
        coureur_id: row.coureur_id,
        statut: row.statut,
        points: row.points,
        date_classement: dateClassement || course.date_fin || course.date_debut,
        saison_id: course.phase_id,
      }));

      // Delete existing results for the current course, classement, and stage
      let deleteQuery = supabase
        .from("race_results")
        .delete()
        .eq("course_id", course.course_id)
        .eq("type_classement", classementType);

      if (etapeNumeroValue) {
        deleteQuery = deleteQuery.eq("etape_numero", etapeNumeroValue);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) throw deleteError;

      // Insert the new results
      const { error: insertError } = await supabase.from("race_results").insert(resultsToSave);

      if (insertError) throw insertError;

      // Save Combatif winner if applicable
      if (currentFinalClassement === "Combatif" && combatifWinner) {
        const { error: deleteError } = await supabase
          .from("race_results")
          .delete()
          .eq("course_id", course.course_id)
          .eq("type_classement", "Combatif");

        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase
          .from("race_results")
          .insert({
            course_id: course.course_id,
            type_classement: "Combatif",
            coureur_id: combatifWinner,
            position: 1,
            statut: "finished" as const,
            date_classement: course.date_fin || course.date_debut,
            saison_id: course.phase_id,
          });

        if (insertError) throw insertError;
      }

      // Save jersey holders for stage races
      if (!isOneDay && activeTab === "stages") {
        const jerseyTypes: JerseyType[] = ['general', 'vert', 'montagne', 'jeune', 'combattif'];

        for (const jerseyType of jerseyTypes) {
          const coureurId = jerseyHolders[jerseyType];

          // Delete existing jersey holders for the current course, stage, and jersey type
          const { error: deleteError } = await supabase
            .from("jersey_holders")
            .delete()
            .eq("course_id", course.course_id)
            .eq("etape_numero", etapeNumero)
            .eq("jersey_type", jerseyType);

          if (deleteError) throw deleteError;

          // Insert the new jersey holder if a coureur is selected
          if (coureurId) {
            const { error: insertError } = await supabase
              .from("jersey_holders")
              .insert({
                course_id: course.course_id,
                etape_numero: etapeNumero,
                jersey_type: jerseyType,
                coureur_id: coureurId,
                saison_id: course.phase_id,
              });

            if (insertError) throw insertError;
          }
        }
      }

      // Compute points if scoring rules are loaded
      if (scoringRules && scoringRules.length > 0) {
        for (const row of resultRows) {
          const rule = scoringRules.find((rule) => rule.position === row.position);
          row.points = rule ? rule.points : 0;
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["race_results", course.course_id] });
      toast({
        title: "Success",
        description: "Results saved successfully.",
      });
      setIsDirty(false);
      if (activeTab === "stages") {
        handleSaveAndNext();
      }
    },
    onError: (error: any) => {
      console.error("Error saving results:", error);
      toast({
        title: "Error",
        description: "Failed to save results.",
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    setIsCancelled(false);
    await saveMutation.mutateAsync();
  };

  const handleSaveAndNext = () => {
    if (currentStage < course.nb_etapes) {
      setCurrentStage(currentStage + 1);
      setGridPrepared(false);
      setIsDirty(false);
    } else {
      onClose();
    }
  };

  const handleRiderChange = (index: number, coureur: { id: string; coureur_nom: string; manager_nom: string } | null) => {
    const newResultRows = [...resultRows];
    newResultRows[index] = {
      ...newResultRows[index],
      coureur_id: coureur?.id || null,
      coureur_nom: coureur?.coureur_nom || null,
      manager_nom: coureur?.manager_nom || null,
    };
    setResultRows(newResultRows);
    setIsDirty(true);
  };

  const handleStatusChange = (index: number, status: ResultStatut) => {
    const newResultRows = [...resultRows];
    newResultRows[index] = { ...newResultRows[index], statut: status };
    setResultRows(newResultRows);
    setIsDirty(true);
  };

  const handleNext = () => {
    if (activeTab === "stages") {
      if (currentStage < course.nb_etapes) {
        setCurrentStage(currentStage + 1);
        setGridPrepared(false);
        setIsDirty(false);
      }
    }
  };

  const handlePrevious = () => {
    if (activeTab === "stages") {
      if (currentStage > 1) {
        setCurrentStage(currentStage - 1);
        setGridPrepared(false);
        setIsDirty(false);
      }
    }
  };

  const finalClassifications: ClassementType[] = course.categorie === "WT GT" 
    ? ["General", "Points", "Montagne", "Jeune", "Combatif"]
    : ["General", "Points", "Montagne", "Jeune"];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">{course.course_nom}</h2>
              <p className="text-sm text-muted-foreground">
                {mode === "create" ? "Enter Results" : "Edit Results"} - {classementType}
                {etapeNumero ? ` - Stage ${etapeNumero}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isDirty && (
              <Badge variant="secondary">
                <Info className="h-4 w-4 mr-2" />
                Unsaved Changes
              </Badge>
            )}
            {saveMutation.isLoading ? (
              <Progress className="w-52" value={50} />
            ) : saveMutation.isError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Error saving results.</AlertDescription>
              </Alert>
            ) : saveMutation.isSuccess ? (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>Results saved.</AlertDescription>
              </Alert>
            ) : null}
            <Button onClick={handleSave} disabled={saveMutation.isLoading}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Tabs for stage races */}
        {!isOneDay && (
          <div className="flex items-center space-x-4">
            <Button variant="outline" active={activeTab === "stages"} onClick={() => setActiveTab("stages")}>
              Stages
            </Button>
            <Button variant="outline" active={activeTab === "finals"} onClick={() => setActiveTab("finals")}>
              Finals
            </Button>
          </div>
        )}

        {/* Stage navigation for stage races */}
        {activeTab === "stages" && !isOneDay && (
          <div className="flex items-center space-x-4">
            <Button variant="secondary" size="sm" onClick={handlePrevious} disabled={currentStage === 1}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous Stage
            </Button>
            <span className="text-sm font-medium">
              Stage {currentStage} of {course.nb_etapes}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleNext}
              disabled={currentStage === course.nb_etapes}
            >
              Next Stage
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Final classification selection */}
        {activeTab === "finals" && !isOneDay && (
          <Select value={currentFinalClassement} onValueChange={(value) => setCurrentFinalClassement(value as ClassementType)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select Final Classification" />
            </SelectTrigger>
            <SelectContent>
              {finalClassifications.map((classification) => (
                <SelectItem key={classification} value={classification}>
                  {classification}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Results grid */}
        {gridPrepared && (
          <div className="space-y-4">
            {/* Combatif winner input for WT GT finals */}
            {currentFinalClassement === "Combatif" && (
              <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Super Combatif</span>
                  <span className="text-xs text-muted-foreground">(150 points)</span>
                </div>
                <CoureursCombobox
                  phaseId={course.phase_id}
                  value={combatifWinner || ""}
                  onSelect={(coureur) => {
                    setCombatifWinner(coureur?.id || null);
                    setIsDirty(true);
                  }}
                  placeholder="Sélectionner le coureur..."
                />
              </div>
            )}

            {/* Jeune classification input for WT GT finals */}
            {currentFinalClassement === "Jeune" && (
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  The best young rider is automatically determined based on the general classification.
                </AlertDescription>
              </Alert>
            )}

            {/* Jersey holders input for stage races */}
            {!isOneDay && activeTab === "stages" && (
              <JerseyHoldersInput
                courseId={course.course_id}
                etapeNumero={currentStage}
                phaseId={course.phase_id}
                holders={jerseyHolders}
                onChange={(holders) => {
                  setJerseyHolders(holders);
                  setIsDirty(true);
                }}
              />
            )}

            {/* Results table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resultRows.map((row, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">{row.position}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <CoureursCombobox
                          phaseId={course.phase_id}
                          value={row.coureur_id || ""}
                          onSelect={(coureur) => handleRiderChange(index, coureur)}
                          placeholder="Select rider..."
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Select value={row.statut} onValueChange={(value) => handleStatusChange(index, value as ResultStatut)}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="finished">Finished</SelectItem>
                            <SelectItem value="dnf">DNF</SelectItem>
                            <SelectItem value="dns">DNS</SelectItem>
                            <SelectItem value="dsq">DSQ</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save buttons */}
            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isLoading}>
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

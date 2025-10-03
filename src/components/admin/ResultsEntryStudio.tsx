import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { X, CheckCircle2, Info, ChevronLeft, ChevronRight, Circle, CheckCircle, Save } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";

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

type ClassementType = "Etape" | "General" | "Points" | "Montagne" | "Jeune";
type ResultStatut = "finished" | "dnf" | "dns" | "dsq";

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

  const isOneDay = course.type_course === "One day";
  const classementType: ClassementType = isOneDay
    ? "General"
    : activeTab === "stages"
    ? "Etape"
    : currentFinalClassement;
  const etapeNumero = activeTab === "stages" && !isOneDay ? currentStage : null;

  const sel_key = `${course.course_id}|${classementType}|${etapeNumero ?? 0}`;

  // Stage completion tracking
  const { data: stageCompletion } = useQuery({
    queryKey: ["stage-completion", course.course_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("race_results")
        .select("etape_numero", { count: "exact" })
        .eq("course_id", course.course_id)
        .eq("type_classement", "Etape");

      if (error) throw error;

      const uniqueStages = new Set(data?.map((r) => r.etape_numero) || []);
      return {
        etapes_saisies: uniqueStages.size,
        completed_stages: Array.from(uniqueStages),
      };
    },
    enabled: !isOneDay,
  });

  const allStagesCompleted = !isOneDay && (stageCompletion?.etapes_saisies ?? 0) >= course.nb_etapes;

  // Scoring rules query using normalized views
  const { data: scoringRules } = useQuery({
    queryKey: ["scoring-rules-studio", course.course_id, classementType],
    queryFn: async () => {
      // Map classement type to canonical form
      const typeMap: Record<ClassementType, string> = {
        Etape: "Etape",
        General: "General",
        Points: "Points",
        Montagne: "Montagne",
        Jeune: "Jeune",
      };
      const typeCanon = typeMap[classementType];

      // First, get the normalized category for this course
      const { data: courseNorm, error: courseError } = await supabase
        .from("courses_for_points_norm")
        .select("cat_canon")
        .eq("id", course.course_id)
        .single();

      if (courseError || !courseNorm) {
        console.error('Error fetching course category:', courseError);
        return [];
      }

      // Then fetch scoring rules using normalized category
      const { data: rulesData, error: rulesError } = await supabase
        .from("scoring_rules_norm")
        .select("place, points")
        .eq("cat_canon", courseNorm.cat_canon)
        .eq("type_canon", typeCanon)
        .order("place");

      if (rulesError) {
        console.error('Error fetching scoring rules:', rulesError);
        return [];
      }

      return rulesData || [];
    },
    staleTime: 0,
    gcTime: 0,
  });

  // Reset state when sel_key changes
  useEffect(() => {
    setResultRows([]);
    setGridPrepared(false);
    setIsDirty(false);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (gridPrepared && resultRows.length > 0) {
          saveMutation.mutate();
        }
      }
      if (e.ctrlKey && e.key === "ArrowRight" && activeTab === "stages" && currentStage < course.nb_etapes) {
        e.preventDefault();
        handleSaveAndNext();
      }
      if (e.ctrlKey && e.key === "ArrowLeft" && activeTab === "stages" && currentStage > 1) {
        e.preventDefault();
        setCurrentStage((prev) => prev - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gridPrepared, resultRows, activeTab, currentStage, course.nb_etapes]);

  // Warn before closing if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handlePrepareGrid = async () => {
    if (!scoringRules || scoringRules.length === 0) {
      toast({
        title: "Barème introuvable",
        description: `Aucun barème défini pour ${course.categorie} / ${classementType}`,
        variant: "destructive",
      });
      return;
    }

    const maxPlace = Math.max(...scoringRules.map((r) => r.place));
    const newRequestId = ++requestIdRef.current;
    setCurrentRequestId(newRequestId);

    let rows: ResultRow[] = [];

    if (mode === 'edit') {
      // Mode Corriger: Load existing results
      try {
        const { data: existingResults, error } = await supabase.rpc('results_course_rows', {
          p_course_id: course.course_id,
          p_type_classement: classementType,
          p_etape_numero: activeTab === 'stages' ? currentStage : null
        });

        if (error) throw error;

        // Use existing results, fill points from scoring rules
        rows = (existingResults || []).map((r: any) => ({
          position: r.row_position,
          coureur_id: r.coureur_id,
          coureur_nom: r.coureur_nom,
          manager_nom: r.manager_nom,
          statut: r.statut,
          points: scoringRules.find(sr => sr.place === r.row_position)?.points || 0,
          grid_version: sel_key,
        }));
      } catch (err: any) {
        console.error('Error loading existing results:', err);
        toast({
          title: "Erreur",
          description: err.message || "Impossible de charger les résultats existants",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Mode Saisir: Empty grid based on scoring rules
      rows = Array.from({ length: maxPlace }, (_, i) => {
        const position = i + 1;
        const rule = scoringRules.find((r) => r.place === position);
        return {
          position,
          coureur_id: null,
          coureur_nom: null,
          manager_nom: null,
          statut: "finished" as ResultStatut,
          points: rule?.points || 0,
          grid_version: sel_key,
        };
      });
    }

    if (newRequestId === currentRequestId || newRequestId > currentRequestId) {
      setResultRows(rows);
      setGridPrepared(true);
      setIsDirty(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validRows = resultRows.filter((r) => r.coureur_id);
      if (validRows.length === 0) {
        throw new Error("Aucune ligne à enregistrer");
      }

      // Check phase_id is set
      if (!course.phase_id) {
        throw new Error("Cette course n'est pas assignée à une phase. Impossible d'attribuer les points aux managers.");
      }

      // Check for duplicates
      const coureurIds = validRows.map((r) => r.coureur_id);
      const duplicates = coureurIds.filter((id, idx) => coureurIds.indexOf(id) !== idx);
      if (duplicates.length > 0) {
        throw new Error("Doublons détectés dans la saisie");
      }

      let resultRowsCount = 0;
      let resultRowsPositive = 0;
      let managerRowsCount = 0;

      // Server-side recalculation of points
      const { data: courseData } = await supabase
        .from("courses")
        .select("categorie")
        .eq("id", course.course_id)
        .single();

      if (!courseData) throw new Error("Course introuvable");

      const typeClassementMap: Record<ClassementType, string> = {
        Etape: "Etape",
        General: "General",
        Points: "Points",
        Montagne: "Montagne",
        Jeune: "Jeune",
      };

      const mappedType = typeClassementMap[classementType] as "Etape" | "General" | "Jeune" | "Montagne" | "Points";
      
      const { data: serverScoringRules } = await supabase
        .from("scoring_rules")
        .select("place, points")
        .eq("categorie", courseData.categorie)
        .eq("type_classement", mappedType)
        .order("place");

      const scoringMap = new Map(
        (serverScoringRules || []).map((r) => [r.place, r.points])
      );

      // Properly cast etape_numero: number for Etape, null otherwise
      const etapeNumeroValue = classementType === "Etape" && etapeNumero ? Number(etapeNumero) : null;

      // Fetch manager_id for each rider first
      const riderManagerMap = new Map<string, string | null>();
      for (const row of validRows) {
        const { data: roster } = await supabase
          .from("rosters")
          .select("manager_id")
          .eq("phase_id", course.phase_id)
          .eq("coureur_id", row.coureur_id!)
          .maybeSingle();
        
        riderManagerMap.set(row.coureur_id!, roster?.manager_id || null);
      }

      // Upsert race_results with manager_id and points
      const mappedTypeForUpsert = typeClassementMap[classementType] as "Etape" | "General" | "Jeune" | "Montagne" | "Points";
      const raceResultsToUpsert = validRows.map((row) => {
        const isFinished = row.statut === "finished";
        const positionValue = isFinished ? Number(row.position) : null;
        const points = isFinished ? scoringMap.get(row.position) || 0 : 0;
        
        return {
          course_id: course.course_id,
          type_classement: mappedTypeForUpsert,
          etape_numero: etapeNumeroValue,
          coureur_id: row.coureur_id!,
          position: positionValue,
          statut: row.statut,
          date_classement: dateClassement,
          manager_id: riderManagerMap.get(row.coureur_id!),
          points,
        };
      });

      const { error: upsertError } = await supabase
        .from("race_results")
        .upsert(raceResultsToUpsert, {
          onConflict: "course_id,type_classement,etape_numero,coureur_id",
        });

      if (upsertError) throw upsertError;

      // Delete old points_ledger entries with proper null handling
      let deleteQuery = supabase
        .from("points_ledger")
        .delete()
        .eq("course_id", course.course_id)
        .eq("type_classement", mappedTypeForUpsert);

      if (etapeNumeroValue !== null) {
        deleteQuery = deleteQuery.eq("etape_numero", etapeNumeroValue);
      } else {
        deleteQuery = deleteQuery.is("etape_numero", null);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;

      // Insert new points_ledger entries
      const pointsLedger = [];
      for (const row of validRows) {
        const isFinished = row.statut === "finished";
        const points = isFinished ? scoringMap.get(row.position) || 0 : 0;

        // Only create ledger entries for riders with points
        if (points > 0) {
          // Find manager_id via rosters
          const { data: roster } = await supabase
            .from("rosters")
            .select("manager_id")
            .eq("phase_id", course.phase_id)
            .eq("coureur_id", row.coureur_id!)
            .maybeSingle();

          if (roster) {
            pointsLedger.push({
              course_id: course.course_id,
              type_classement: typeClassementMap[classementType],
              etape_numero: etapeNumeroValue,
              coureur_id: row.coureur_id!,
              phase_id: course.phase_id,
              manager_id: roster.manager_id,
              points,
            });
          }
        }
      }

      if (pointsLedger.length > 0) {
        const { error: insertError } = await supabase
          .from("points_ledger")
          .insert(pointsLedger);

        if (insertError) throw insertError;
        managerRowsCount = pointsLedger.length;
      }

      resultRowsCount = validRows.length;
      resultRowsPositive = validRows.filter(r => r.statut === "finished" && scoringMap.get(r.position)).length;

      // Verification check
      const { data: verifyData } = await supabase.rpc("verify_course_save", {
        p_course_id: course.course_id,
      });

      return { 
        inserted: validRows.length, 
        ledger: pointsLedger.length,
        result_rows: resultRowsCount,
        result_rows_positive: resultRowsPositive,
        manager_rows: managerRowsCount,
        verify: verifyData?.[0] || null,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stage-completion"] });
      queryClient.invalidateQueries({ queryKey: ["results-status"] });
      queryClient.invalidateQueries({ queryKey: ["manager-standings"] });
      queryClient.invalidateQueries({ queryKey: ["top-riders"] });
      queryClient.invalidateQueries({ queryKey: ["recent-points"] });
      queryClient.invalidateQueries({ queryKey: ["rankings-kpis"] });

      const label = activeTab === "stages" ? `ÉTAPE ${currentStage}` : classementType.toUpperCase();
      toast({
        title: "✅ Résultats enregistrés",
        description: `${label} — ${data.manager_rows} attributions créées · ${data.result_rows_positive} lignes scorées / ${data.result_rows} résultats`,
      });
      setIsDirty(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveAndNext = () => {
    if (!gridPrepared || resultRows.length === 0) return;
    saveMutation.mutate(undefined, {
      onSuccess: () => {
        if (currentStage < course.nb_etapes) {
          setCurrentStage((prev) => prev + 1);
        }
      },
    });
  };

  const handleRiderChange = (index: number, riderId: string | null, riderName: string | null, managerNom: string | null = null) => {
    setResultRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, coureur_id: riderId, coureur_nom: riderName, manager_nom: managerNom } : row
      )
    );
    setIsDirty(true);
  };

  const handleStatutChange = (index: number, statut: ResultStatut) => {
    setResultRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const rule = scoringRules?.find((r) => r.place === row.position);
        return {
          ...row,
          statut,
          points: statut === "finished" ? rule?.points || 0 : 0,
        };
      })
    );
    setIsDirty(true);
  };

  const validLinesCount = resultRows.filter((r) => r.coureur_id).length;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{course.course_nom}</h2>
              <Badge variant="outline">{course.categorie}</Badge>
              <Badge variant={course.type_course === "One day" ? "secondary" : "default"}>
                {course.type_course}
              </Badge>
              <Badge variant={mode === 'create' ? 'default' : 'outline'}>
                {mode === 'create' ? 'Saisie' : 'Correction'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(course.date_debut), "d MMM", { locale: fr })} →{" "}
              {format(new Date(course.date_fin), "d MMM yyyy", { locale: fr })}
            </p>

            {!isOneDay && (
              <div className="mt-3 flex items-center gap-4">
                <div className="flex-1 max-w-xs">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Étapes</span>
                    <span className="font-medium">
                      {stageCompletion?.etapes_saisies ?? 0} / {course.nb_etapes}
                    </span>
                  </div>
                  <Progress
                    value={((stageCompletion?.etapes_saisies ?? 0) / course.nb_etapes) * 100}
                  />
                </div>
                {allStagesCompleted && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Toutes les étapes saisies
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Stage Race Tabs */}
          {!isOneDay && (
            <div className="mb-6 flex gap-2">
              <Button
                variant={activeTab === "stages" ? "default" : "outline"}
                onClick={() => setActiveTab("stages")}
              >
                Étapes
              </Button>
              <Button
                variant={activeTab === "finals" ? "default" : "outline"}
                onClick={() => setActiveTab("finals")}
                disabled={!allStagesCompleted}
              >
                Classements finaux
              </Button>
            </div>
          )}

          {/* Stage Navigation */}
          {!isOneDay && activeTab === "stages" && (
            <div className="mb-6 flex items-center gap-2">
              {Array.from({ length: course.nb_etapes }, (_, i) => i + 1).map((stage) => {
                const isCompleted = stageCompletion?.completed_stages.includes(stage);
                const isCurrent = stage === currentStage;
                return (
                  <Button
                    key={stage}
                    variant={isCurrent ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentStage(stage)}
                    className="gap-2"
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                    Étape {stage}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Finals Segmented Control */}
          {!isOneDay && activeTab === "finals" && (
            <div className="mb-6 flex gap-2">
              {(["General", "Points", "Montagne", "Jeune"] as ClassementType[]).map((type) => (
                <Button
                  key={type}
                  variant={currentFinalClassement === type ? "default" : "outline"}
                  onClick={() => setCurrentFinalClassement(type)}
                >
                  {type}
                </Button>
              ))}
            </div>
          )}

          {/* Title & Date */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {isOneDay
                ? "Résultat final (One-day)"
                : activeTab === "stages"
                ? `Étape ${currentStage}`
                : currentFinalClassement}
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Date:</label>
              <Input
                type="date"
                value={dateClassement}
                onChange={(e) => setDateClassement(e.target.value)}
                className="w-40"
              />
            </div>
          </div>

          {/* Scoring Info */}
          {scoringRules && scoringRules.length === 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Aucun barème trouvé pour {course.categorie} / {classementType}
              </AlertDescription>
            </Alert>
          )}

          {/* Results Table */}
          {gridPrepared && (
            <div key={sel_key} className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium w-20">Pos</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Coureur</th>
                      <th className="px-4 py-3 text-left text-sm font-medium w-32">Manager</th>
                      <th className="px-4 py-3 text-right text-sm font-medium w-24">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resultRows.map((row, index) => (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="px-4 py-2 text-sm font-medium">{row.position}</td>
                        <td className="px-4 py-2">
                          <CoureursCombobox
                            phaseId={course.phase_id}
                            value={row.coureur_id}
                            onSelect={(coureur) => {
                              if (coureur) {
                                handleRiderChange(index, coureur.coureur_id, coureur.coureur_nom, coureur.taken_by_manager_nom);
                              } else {
                                handleRiderChange(index, null, null, null);
                              }
                            }}
                            showTakenRiders={true}
                          />
                        </td>
                        <td className="px-4 py-2">
                          {row.manager_nom ? (
                            <Badge variant="secondary" className="text-xs">
                              {row.manager_nom}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-medium">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Footer Actions */}
      {gridPrepared && (
        <div className="sticky bottom-0 z-10 bg-background border-t px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {validLinesCount} / {resultRows.length} lignes valides
              </span>
              {isDirty && <Badge variant="outline">Non sauvegardé</Badge>}
            </div>

            <div className="flex items-center gap-2">
              {!isOneDay && activeTab === "stages" && currentStage > 1 && (
                <Button variant="ghost" onClick={() => setCurrentStage((prev) => prev - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Étape précédente
                </Button>
              )}

              <Button variant="outline" onClick={onClose}>
                Retour
              </Button>

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>

              {!isOneDay && activeTab === "stages" && currentStage < course.nb_etapes && (
                <Button onClick={handleSaveAndNext} disabled={saveMutation.isPending}>
                  Enregistrer & Suivante
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


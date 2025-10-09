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
  const [combatifWinner, setCombatifWinner] = useState<string | null>(null);
  const [jeuneWinner, setJeuneWinner] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

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
      // Get stages with results - filter by date
      const { data: resultsData, error: resultsError } = await supabase
        .from("race_results")
        .select("etape_numero")
        .eq("course_id", course.course_id)
        .eq("type_classement", "Etape")
        .gte("date_classement", course.date_debut)
        .lte("date_classement", course.date_fin);

      if (resultsError) throw resultsError;

      // Get cancelled stages
      const { data: cancelledData, error: cancelledError } = await supabase
        .from("race_result_sets")
        .select("etape_numero")
        .eq("course_id", course.course_id)
        .eq("type_classement", "Etape")
        .eq("is_cancelled", true);

      if (cancelledError) throw cancelledError;

      // Combine both sets
      const stagesWithResults = new Set(resultsData?.map(r => r.etape_numero) || []);
      const cancelledStages = new Set(cancelledData?.map(r => r.etape_numero) || []);
      const allCompletedStages = new Set([...stagesWithResults, ...cancelledStages]);

      return {
        etapes_saisies: allCompletedStages.size,
        completed_stages: Array.from(allCompletedStages),
      };
    },
    enabled: !isOneDay,
  });

  const allStagesCompleted = !isOneDay && (stageCompletion?.etapes_saisies ?? 0) >= course.nb_etapes;

  // Scoring rules query using normalized views
  const { data: scoringRules } = useQuery({
    queryKey: ["scoring-rules-studio", course.course_id, classementType],
    queryFn: async () => {
      // Map classement type to canonical form (only for scoring rules)
      const typeMap: Record<string, string> = {
        Etape: "Etape",
        General: "General",
        Points: "Points",
        Montagne: "Montagne",
        Jeune: "Jeune",
        Combatif: "Combatif",
      };
      const typeCanon = typeMap[classementType] || classementType;

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
    setIsCancelled(false);
    setJerseyHolders({
      general: null,
      vert: null,
      montagne: null,
      jeune: null,
      combattif: null,
    });

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
    const newRequestId = ++requestIdRef.current;
    setCurrentRequestId(newRequestId);

    let rows: ResultRow[] = [];

    // ALWAYS try to load existing results first (both for 'edit' and 'create' modes)
    try {
      const { data: existingData, error: loadError } = await supabase.functions.invoke('results-course-rows', {
        body: {
          course_id: course.course_id,
          type_classement: classementType,
          etape_numero: activeTab === 'stages' ? currentStage : null
        }
      });

      if (loadError) throw loadError;

      const existingResults = existingData?.rows || [];

      // Load cancellation status from race_result_sets
      const etapeNumeroValue = classementType === "Etape" && etapeNumero ? Number(etapeNumero) : null;
      const { data: resultSetData } = await supabase
        .from('race_result_sets')
        .select('is_cancelled')
        .eq('course_id', course.course_id)
        .eq('type_classement', classementType)
        .eq('etape_numero', etapeNumeroValue)
        .maybeSingle();

      setIsCancelled(resultSetData?.is_cancelled || false);

      // Load jersey holders if on stage race + stages tab
      if (!isOneDay && activeTab === "stages" && etapeNumero) {
        const jerseyTypes: Array<{ type: ClassementType; key: JerseyType }> = [
          { type: 'Porteur Général', key: 'general' },
          { type: 'Porteur Vert', key: 'vert' },
          { type: 'Porteur Montagne', key: 'montagne' },
          { type: 'Porteur Jeune', key: 'jeune' },
          { type: 'Porteur Combattif', key: 'combattif' },
        ];

        const newJerseyHolders: JerseyHolders = {
          general: null,
          vert: null,
          montagne: null,
          jeune: null,
          combattif: null,
        };

        for (const { type, key } of jerseyTypes) {
          // ✅ Requête directe qui ne charge que les porteurs explicitement validés - filter by date
          const { data: jerseyData } = await supabase
            .from('race_results')
            .select('coureur_id')
            .eq('course_id', course.course_id)
            .eq('type_classement', type)  // "Porteur Général", etc.
            .eq('etape_numero', currentStage)
            .eq('position', 1)  // ✅ Vérifie que c'est bien un porteur validé
            .gte('date_classement', course.date_debut)
            .lte('date_classement', course.date_fin)
            .maybeSingle();

          if (jerseyData?.coureur_id) {
            newJerseyHolders[key] = jerseyData.coureur_id;
          }
        }

        setJerseyHolders(newJerseyHolders);
      }

      // Load Jeune winner if on finals tab
      if (!isOneDay && activeTab === "finals" && currentFinalClassement === "Jeune") {
        const { data: jeuneData } = await supabase
          .from('race_results')
          .select('coureur_id')
          .eq('course_id', course.course_id)
          .eq('type_classement', 'Jeune')
          .is('etape_numero', null)
          .eq('position', 1)
          .gte('date_classement', course.date_debut)
          .lte('date_classement', course.date_fin)
          .maybeSingle();

        setJeuneWinner(jeuneData?.coureur_id || null);
      }

      // Load Combatif winner if on finals tab for WT GT
      if (!isOneDay && activeTab === "finals" && currentFinalClassement === "Combatif" && course.categorie === 'WT GT') {
        const { data: combatifData } = await supabase
          .from('race_results')
          .select('coureur_id')
          .eq('course_id', course.course_id)
          .eq('type_classement', 'Combatif')
          .is('etape_numero', null)
          .eq('position', 1)
          .gte('date_classement', course.date_debut)
          .lte('date_classement', course.date_fin)
          .maybeSingle();

        setCombatifWinner(combatifData?.coureur_id || null);
      }

      console.log('🔄 Chargement des résultats:', {
        courseId: course.course_id,
        classementType,
        etapeNumero,
        existingResultsCount: existingResults.length
      });

      if (existingResults.length > 0) {
        // Pre-existing results found - merge with full grid from scoring rules
        if (!scoringRules || scoringRules.length === 0) {
          toast({
            title: "Barème introuvable",
            description: `Résultats chargés mais aucun barème trouvé pour ${course.categorie} / ${classementType}. Points affichés = 0.`,
            variant: "default",
          });
          // Still display existing results even without scoring rules
          rows = existingResults.map((r: any) => ({
            position: r.row_position,
            coureur_id: r.coureur_id,
            coureur_nom: r.coureur_nom,
            manager_nom: r.manager_nom,
            statut: r.statut,
            points: 0,
            grid_version: sel_key,
          }));
        } else {
          // Create full grid based on scoring rules
          const maxPlace = Math.max(...scoringRules.map((r) => r.place));
          rows = Array.from({ length: maxPlace }, (_, i) => {
            const position = i + 1;
            const rule = scoringRules.find((r) => r.place === position);
            // Check if we have existing data for this position
            const existing = existingResults.find((r: any) => r.row_position === position);
            
            return {
              position,
              coureur_id: existing?.coureur_id || null,
              coureur_nom: existing?.coureur_nom || null,
              manager_nom: existing?.manager_nom || null,
              statut: existing?.statut || ("finished" as ResultStatut),
              points: rule?.points || 0,
              grid_version: sel_key,
            };
          });
        }
      } else {
        // No existing results - create empty grid from scoring rules
        if (!scoringRules || scoringRules.length === 0) {
          toast({
            title: "Barème introuvable",
            description: `Aucun barème défini pour ${course.categorie} / ${classementType}`,
            variant: "destructive",
          });
          return;
        }

        const maxPlace = Math.max(...scoringRules.map((r) => r.place));
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
    } catch (err: any) {
      console.error('Error loading results:', err);
      
      // Fallback: try to create empty grid from scoring rules
      if (scoringRules && scoringRules.length > 0) {
        const maxPlace = Math.max(...scoringRules.map((r) => r.place));
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
      } else {
        toast({
          title: "Erreur",
          description: err.message || "Impossible de charger les résultats",
          variant: "destructive",
        });
        return;
      }
    }

    if (newRequestId === currentRequestId || newRequestId > currentRequestId) {
      setResultRows(rows);
      setGridPrepared(true);
      setIsDirty(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const etapeNumeroValue = classementType === "Etape" && etapeNumero ? Number(etapeNumero) : null;

      // Update cancellation status in race_result_sets
      await supabase
        .from('race_result_sets')
        .update({ is_cancelled: isCancelled })
        .eq('course_id', course.course_id)
        .eq('type_classement', classementType)
        .eq('etape_numero', etapeNumeroValue);

      // If cancelled, delete all results and return
      if (isCancelled) {
        await supabase
          .from('race_results')
          .delete()
          .eq('course_id', course.course_id)
          .eq('type_classement', classementType)
          .eq('etape_numero', etapeNumeroValue);
        
        return { success: true, message: 'Annulation enregistrée' };
      }

      // Otherwise, save results normally
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

      // Prepare rows for DB function
      const rowsForDb = validRows.map((row) => ({
        coureur_id: row.coureur_id!,
        position: Number(row.position),
        statut: row.statut,
      }));

      // Call unified UPSERT function (handles both create and update)
      const { data: saveResult, error: saveError } = await supabase.rpc("admin_result_save_lot", {
        p_course_id: course.course_id,
        p_type_classement: classementType,
        p_etape_numero: etapeNumeroValue,
        p_rows: rowsForDb,
      });

      if (saveError) throw saveError;

      // Immediately recompute points for this course to reflect Porteur points
      const { error: computeError } = await supabase.functions.invoke('compute-points', {
        body: { course_id: course.course_id }
      });
      
      if (computeError) {
        console.error('Error recomputing points after save:', computeError);
      }

      // Save jersey holders if on stage race + stages tab
      if (!isOneDay && activeTab === "stages" && etapeNumero) {
        console.log('🔵 Sauvegarde des porteurs de maillots:', {
          courseId: course.course_id,
          etapeNumero: Number(etapeNumero),
          jerseyHolders: jerseyHolders
        });

        const jerseyMappings: Array<{ type: ClassementType; key: JerseyType }> = [
          { type: 'Porteur Général', key: 'general' },
          { type: 'Porteur Vert', key: 'vert' },
          { type: 'Porteur Montagne', key: 'montagne' },
          { type: 'Porteur Jeune', key: 'jeune' },
          { type: 'Porteur Combattif', key: 'combattif' },
        ];

        for (const { type, key } of jerseyMappings) {
          const coureurId = jerseyHolders[key];
          if (coureurId) {
            console.log(`🟡 Sauvegarde ${type} (étape ${etapeNumero}):`, {
              coureurId,
              typeClassement: type
            });

            const { data, error: jerseyError } = await supabase.rpc("admin_result_save_lot", {
              p_course_id: course.course_id,
              p_type_classement: type,
              p_etape_numero: Number(etapeNumero),
              p_rows: [{ coureur_id: coureurId, position: 1, statut: 'finished' as ResultStatut }],
            });

            console.log(`✅ Réponse pour ${type}:`, { data, error: jerseyError });
            if (jerseyError) console.error(`Error saving ${type}:`, jerseyError);
          }
        }
      }

      // Save Jeune winner if on finals tab
      if (!isOneDay && activeTab === "finals" && currentFinalClassement === "Jeune" && jeuneWinner) {
        await supabase.rpc("admin_result_save_lot", {
          p_course_id: course.course_id,
          p_type_classement: 'Jeune' as ClassementType,
          p_etape_numero: null,
          p_rows: [{ coureur_id: jeuneWinner, position: 1, statut: 'finished' as ResultStatut }],
        });
      }

      // Save Combatif winner if on finals tab for WT GT
      if (!isOneDay && activeTab === "finals" && currentFinalClassement === "Combatif" && course.categorie === 'WT GT' && combatifWinner) {
        await supabase.rpc("admin_result_save_lot", {
          p_course_id: course.course_id,
          p_type_classement: 'Combatif' as ClassementType,
          p_etape_numero: null,
          p_rows: [{ coureur_id: combatifWinner, position: 1, statut: 'finished' as ResultStatut }],
        });
      }

      // Compute points for this course
      const { data: pointsResult, error: pointsError } = await supabase.rpc("admin_compute_points_for_course", {
        p_course_id: course.course_id,
      });

      if (pointsError) throw pointsError;

      // Verification check
      const { data: verifyData } = await supabase.rpc("verify_course_save", {
        p_course_id: course.course_id,
      });

      return { 
        saveResult,
        pointsResult,
        verifyData,
      };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["stage-completion"] });
      queryClient.invalidateQueries({ queryKey: ["results-status"] });
      queryClient.invalidateQueries({ queryKey: ["manager-standings"] });
      queryClient.invalidateQueries({ queryKey: ["top-riders"] });
      queryClient.invalidateQueries({ queryKey: ["recent-points"] });
      queryClient.invalidateQueries({ queryKey: ["rankings-kpis"] });

      if (data.message === 'Annulation enregistrée') {
        toast({
          title: "✅ Annulation enregistrée",
          description: "Les résultats ont été supprimés",
        });
      } else {
        const label = activeTab === "stages" ? `ÉTAPE ${currentStage}` : classementType.toUpperCase();
        const rowsAffected = (data.saveResult as any)?.rows_affected || 0;
        const pointsRows = (data.pointsResult as any)?.rows_upserted || 0;
        
        toast({
          title: "✅ Résultats enregistrés",
          description: `${label} — ${rowsAffected} résultats · ${pointsRows} points attribués`,
        });
      }
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
              {(["General", "Points", "Montagne", "Jeune"] as ClassementType[])
                .concat(course.categorie === 'WT GT' ? ["Combatif"] : [])
                .map((type) => (
                <Button
                  key={type}
                  variant={currentFinalClassement === type ? "default" : "outline"}
                  onClick={() => setCurrentFinalClassement(type)}
                >
                  {type === 'Combatif' ? 'Super Combatif' : type}
                </Button>
              ))}
            </div>
          )}

          {/* Title & Date */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                {isOneDay
                  ? "Résultat final (One-day)"
                  : activeTab === "stages"
                  ? `Étape ${currentStage}`
                  : currentFinalClassement}
              </h3>
              {(() => {
                const filledCount = resultRows.filter(r => r.coureur_id !== null).length;
                const totalCount = resultRows.length;
                const isPartial = filledCount > 0 && filledCount < totalCount;
                
                return isPartial ? (
                  <Badge variant="secondary" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Résultats partiels ({filledCount}/{totalCount})
                  </Badge>
                ) : null;
              })()}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cancelled-checkbox"
                  checked={isCancelled}
                  onCheckedChange={async (checked) => {
                    setIsCancelled(checked === true);
                    if (checked) {
                      setResultRows(prev => prev.map(row => ({
                        ...row,
                        coureur_id: null,
                        coureur_nom: null,
                        manager_nom: null,
                      })));
                      setIsDirty(true);
                      
                      // Create/update race_result_set immediately
                      const etapeNumeroValue = classementType === "Etape" && etapeNumero ? Number(etapeNumero) : null;
                      const { data: managerData } = await supabase
                        .from('managers')
                        .select('id')
                        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
                        .single();

                      const { data: phaseData } = await supabase
                        .from('phases')
                        .select('saison_id')
                        .eq('id', course.phase_id)
                        .single();

                      if (managerData?.id && phaseData?.saison_id) {
                        await supabase
                          .from('race_result_sets')
                          .upsert({
                            course_id: course.course_id,
                            saison_id: phaseData.saison_id,
                            type_classement: classementType,
                            etape_numero: etapeNumeroValue,
                            is_cancelled: true,
                            created_by: managerData.id
                          }, {
                            onConflict: 'course_id,type_classement,etape_numero',
                            ignoreDuplicates: false
                          });
                        
                        // Refresh stage completion
                        queryClient.invalidateQueries({ queryKey: ["stage-completion", course.course_id] });
                      }
                    } else {
                      // When unchecking, update is_cancelled to false
                      const etapeNumeroValue = classementType === "Etape" && etapeNumero ? Number(etapeNumero) : null;
                      await supabase
                        .from('race_result_sets')
                        .update({ is_cancelled: false })
                        .eq('course_id', course.course_id)
                        .eq('type_classement', classementType)
                        .eq('etape_numero', etapeNumeroValue);
                      
                      queryClient.invalidateQueries({ queryKey: ["stage-completion", course.course_id] });
                    }
                  }}
                />
                <label htmlFor="cancelled-checkbox" className="text-sm font-medium cursor-pointer">
                  {activeTab === "stages" && !isOneDay ? "Étape annulée" : "Course annulée"}
                </label>
              </div>
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
          </div>

          {/* Info message for cancelled stages */}
          {!isOneDay && activeTab === "stages" && isCancelled && (
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Cette étape annulée ne bloque pas la saisie des classements finaux (CG, Points, etc.)
              </AlertDescription>
            </Alert>
          )}

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
                      <tr key={index} className={cn("hover:bg-muted/50", isCancelled && "opacity-50 pointer-events-none")}>
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
                            disabled={isCancelled}
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

          {/* Jersey Holders Section - Only for Stage Races on Stages Tab */}
          {!isOneDay && activeTab === "stages" && gridPrepared && (
            <div className="mt-6">
              <JerseyHoldersInput
                phaseId={course.phase_id}
                jerseyHolders={jerseyHolders}
                onChange={(type, coureurId) => {
                  setJerseyHolders(prev => ({ ...prev, [type]: coureurId }));
                  setIsDirty(true);
                }}
              />
            </div>
          )}

          {/* Jeune Winner Input - Only for Stage Races on Finals Tab */}
          {!isOneDay && activeTab === "finals" && currentFinalClassement === "Jeune" && (
            <div className="mt-6 border rounded-lg p-4">
              <h4 className="text-sm font-medium mb-3">Gagnant du Maillot Blanc</h4>
              <CoureursCombobox
                phaseId={course.phase_id}
                value={jeuneWinner}
                onSelect={(coureur) => {
                  setJeuneWinner(coureur?.coureur_id || null);
                  setIsDirty(true);
                }}
                showTakenRiders={true}
              />
            </div>
          )}

          {/* Super Combatif Winner Input - Only for WT GT on Finals Tab */}
          {!isOneDay && activeTab === "finals" && currentFinalClassement === "Combatif" && course.categorie === 'WT GT' && (
            <div className="mt-6 border rounded-lg p-4">
              <h4 className="text-sm font-medium mb-3">Gagnant du Super Combatif (150 points)</h4>
              <CoureursCombobox
                phaseId={course.phase_id}
                value={combatifWinner}
                onSelect={(coureur) => {
                  setCombatifWinner(coureur?.coureur_id || null);
                  setIsDirty(true);
                }}
                showTakenRiders={true}
              />
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


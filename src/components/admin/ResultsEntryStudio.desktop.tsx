import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueClient } from "@/lib/supabase/leagueClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { X, CheckCircle2, Info, ChevronLeft, ChevronRight, Circle, CheckCircle, Save, AlertCircle, Loader2, Camera, Trash2, ChevronDown, ChevronUp, Download } from "lucide-react";
import { ExportResultsImage } from "./ExportResultsImage";
import { PcsSlugDialog } from "./PcsSlugDialog";
import { usePcsImport } from "@/hooks/usePcsImport";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";
import { EquipeCombobox } from "@/components/shared/EquipeCombobox";
import { JerseyHoldersInput } from "@/components/admin/JerseyHoldersInput";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

type ClassementType = "Etape" | "General" | "Points" | "Montagne" | "Jeune" | "Combatif" | "Porteur Leader" | "Porteur Vert" | "Porteur Montagne" | "Porteur Jeune" | "Porteur Combattif";
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
  coureur_equipe?: string | null;
  statut: ResultStatut;
  points: number;
  grid_version?: string;
  // TTT specific fields
  equipe_id?: string | null;
  is_expanded?: boolean;
  team_riders?: Array<{
    coureur_id: string | null;
    coureur_nom: string | null;
    coureur_equipe?: string | null;
    position_decimal: number;
  }>;
};

type StudioProps = {
  course: CourseData;
  mode: 'create' | 'edit';
  onClose: () => void;
};

// Hook to track previous values
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export const ResultsEntryStudio = ({ course, mode, onClose }: StudioProps) => {
  const queryClient = useQueryClient();
  const leagueClient = useLeagueClient();
  const { importFromPcs, isImporting: isPcsImporting } = usePcsImport();
  const [activeTab, setActiveTab] = useState<"stages" | "finals">("stages");
  const [currentStage, setCurrentStage] = useState(1);
  const [currentFinalClassement, setCurrentFinalClassement] = useState<ClassementType>("General");
  const [dateClassement, setDateClassement] = useState("");
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [gridPrepared, setGridPrepared] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const requestIdRef = useRef(0);
  const [currentRequestId, setCurrentRequestId] = useState(0);
  const [isLoadingGrid, setIsLoadingGrid] = useState(false);
  const [jerseyHolders, setJerseyHolders] = useState<JerseyHolders>({
    general: null,
    vert: null,
    montagne: null,
    jeune: null,
    combattif: null,
  });
  // Keep a ref to avoid stale state inside mutations (user can click Save immediately after selection)
  const jerseyHoldersRef = useRef<JerseyHolders>(jerseyHolders);
  useEffect(() => {
    jerseyHoldersRef.current = jerseyHolders;
  }, [jerseyHolders]);
  const [combatifWinner, setCombatifWinner] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pcsSlugDialogOpen, setPcsSlugDialogOpen] = useState(false);
  const [pcsSlugError, setPcsSlugError] = useState<{ message: string; slugUsed: string }>({ message: '', slugUsed: '' });
  const [isTTT, setIsTTT] = useState(false);
  const [tttRidersCount, setTttRidersCount] = useState(7);
  const [saisonId, setSaisonId] = useState<string | null>(null);
  
  // Track if TTT was manually set by user to prevent DB from overwriting it
  const tttManuallySet = useRef(false);

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
      // 1. Récupérer la saison de la course
      const { data: phaseData, error: phaseError } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', course.phase_id)
        .single();

      if (phaseError || !phaseData) {
        console.error('Error fetching phase:', phaseError);
        return [];
      }

      // 2. Mapper le type de classement
      const typeMap: Record<string, string> = {
        Etape: "Etape",
        General: "General",
        Points: "Points",
        Montagne: "Montagne",
        Jeune: "Jeune",
        Combatif: "Combatif",
      };
      const typeClassementValue = typeMap[classementType] || classementType;

      // 3. Récupérer les barèmes directement depuis scoring_rules_saisons
      const { data: rulesData, error: rulesError } = await supabase
        .from("scoring_rules_saisons")
        .select("place, points")
        .eq("saison_id", phaseData.saison_id)
        .eq("categorie", course.categorie)
        .eq("type_classement", typeClassementValue as any)
        .order("place");

      if (rulesError) {
        console.error('Error fetching scoring rules:', rulesError);
        return [];
      }

      return rulesData || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - scoring rules rarely change
    gcTime: 10 * 60 * 1000,   // 10 minutes in cache
  });

  // Load saison_id on mount
  useEffect(() => {
    const loadSaisonId = async () => {
      const { data } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', course.phase_id)
        .single();
      
      if (data) {
        setSaisonId(data.saison_id);
      }
    };
    loadSaisonId();
  }, [course.phase_id]);

  // Reset state when sel_key changes
  useEffect(() => {
    setResultRows([]);
    setGridPrepared(false);
    setIsDirty(false);
    setIsCancelled(false);
    // jerseyHolders reset moved to handlePrepareGrid to avoid race condition

    // Auto-set date
    if (activeTab === "stages" && etapeNumero) {
      const stageDate = new Date(course.date_debut);
      stageDate.setDate(stageDate.getDate() + etapeNumero - 1);
      setDateClassement(format(stageDate, "yyyy-MM-dd"));
    } else {
      setDateClassement(course.date_fin);
    }
  }, [sel_key, activeTab, etapeNumero, course.date_debut, course.date_fin]);

  // Track previous values to detect real changes
  const prevStage = usePrevious(currentStage);
  const prevFinalClassement = usePrevious(currentFinalClassement);
  const prevActiveTab = usePrevious(activeTab);

  // Reset TTT settings ONLY when stage/classification actually changes
  useEffect(() => {
    const stageChanged = prevStage !== undefined && prevStage !== currentStage;
    const classementChanged = prevFinalClassement !== undefined && prevFinalClassement !== currentFinalClassement;
    const tabChanged = prevActiveTab !== undefined && prevActiveTab !== activeTab;
    
    if (stageChanged || classementChanged || tabChanged) {
      console.log('🔄 Real stage/tab change detected, resetting TTT', { prevStage, currentStage, prevActiveTab, activeTab });
      tttManuallySet.current = false; // Reset manual flag on stage/tab change
      setIsTTT(false);
      setTttRidersCount(7);
    }
  }, [currentStage, currentFinalClassement, activeTab, prevStage, prevFinalClassement, prevActiveTab]);

  // Memoize handlePrepareGrid with all dependencies
  const handlePrepareGrid = useCallback(async () => {
    console.log('🔧 handlePrepareGrid called', { sel_key, classementType, etapeNumero });
    const newRequestId = ++requestIdRef.current;
    setCurrentRequestId(newRequestId);
    setIsLoadingGrid(true);

    // Reset jerseyHolders at the start to avoid stale data, before fetching new ones
    setJerseyHolders({
      general: null,
      vert: null,
      montagne: null,
      jeune: null,
      combattif: null,
    });

    let rows: ResultRow[] = [];

    try {
      console.log('🛰️ Starting parallel queries');
      const etapeNumeroValue = classementType === "Etape" && etapeNumero ? Number(etapeNumero) : null;

      // Parallelize ALL queries using Promise.all
      const [existingData, resultSetData, jerseyDataArray, combatifData] = await Promise.all([
        // 1. Load existing results
        supabase.functions.invoke('results-course-rows', {
          body: {
            course_id: course.course_id,
            type_classement: classementType,
            etape_numero: etapeNumero
          }
        }),
        
        // 2. Load cancellation status AND TTT info
        supabase
          .from('race_result_sets')
          .select('is_cancelled, is_ttt, ttt_riders_count')
          .eq('course_id', course.course_id)
          .eq('type_classement', classementType)
          .eq('etape_numero', etapeNumeroValue)
          .maybeSingle(),
        
        // 3. Load ALL jersey holders in one query (if needed)
        !isOneDay && activeTab === "stages" && etapeNumero
          ? supabase
              .from('race_results')
              .select('coureur_id, type_classement')
              .eq('course_id', course.course_id)
              .in('type_classement', ['Porteur Leader', 'Porteur Vert', 'Porteur Montagne', 'Porteur Jeune', 'Porteur Combattif'])
              .eq('etape_numero', currentStage)
              .eq('position', 1)
          : Promise.resolve({ data: [] }),
        
        // 4. Load Combatif winner (if needed)
        !isOneDay && activeTab === "finals" && currentFinalClassement === "Combatif" && course.categorie === 'WT GT'
          ? supabase
              .from('race_results')
              .select('coureur_id')
              .eq('course_id', course.course_id)
              .eq('type_classement', 'Combatif')
              .is('etape_numero', null)
              .eq('position', 1)
              .gte('date_classement', course.date_debut)
              .lte('date_classement', course.date_fin)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      console.log('✅ All parallel queries completed');

      if (existingData.error) throw existingData.error;

      const existingResults = existingData.data?.rows || [];
      console.log('📊 Résultats existants chargés:', existingResults.length);

      // Set cancellation status and TTT mode
      setIsCancelled(resultSetData?.data?.is_cancelled || false);
      
      // Only load TTT settings from DB if not manually set by user
      if (!tttManuallySet.current) {
        setIsTTT(resultSetData?.data?.is_ttt || false);
        setTttRidersCount(resultSetData?.data?.ttt_riders_count || 7);
      }

      // Map jersey holders from single query
      if (!isOneDay && activeTab === "stages" && etapeNumero) {
        const newJerseyHolders: JerseyHolders = {
          general: null,
          vert: null,
          montagne: null,
          jeune: null,
          combattif: null,
        };

        jerseyDataArray?.data?.forEach((j: any) => {
          if (j.type_classement === 'Porteur Leader') newJerseyHolders.general = j.coureur_id;
          if (j.type_classement === 'Porteur Vert') newJerseyHolders.vert = j.coureur_id;
          if (j.type_classement === 'Porteur Montagne') newJerseyHolders.montagne = j.coureur_id;
          if (j.type_classement === 'Porteur Jeune') newJerseyHolders.jeune = j.coureur_id;
          if (j.type_classement === 'Porteur Combattif') newJerseyHolders.combattif = j.coureur_id;
        });

        setJerseyHolders(newJerseyHolders);
      }

      // Set combatif winner
      setCombatifWinner(combatifData?.data?.coureur_id || null);

      console.log('🔄 Chargement des résultats:', {
        courseId: course.course_id,
        classementType,
        etapeNumero,
        existingResultsCount: existingResults.length,
        isTTT: resultSetData?.data?.is_ttt
      });

      if (existingResults.length > 0) {
        console.log('✅ Résultats existants trouvés, barème disponible:', scoringRules?.length || 0);
        
        // Check if this is TTT mode with existing results
        if (resultSetData?.data?.is_ttt) {
          // TTT Mode: Group results by team
          const teamResults: Record<number, { equipe_id: string; riders: any[] }> = {};
          
          existingResults.forEach((r: any) => {
            if (!teamResults[r.row_position]) {
              teamResults[r.row_position] = {
                equipe_id: r.equipe_id,
                riders: []
              };
            }
            teamResults[r.row_position].riders.push({
              coureur_id: r.coureur_id,
              coureur_nom: r.coureur_nom,
              coureur_equipe: r.coureur_equipe,
              position_decimal: r.position_decimal || (r.row_position + (teamResults[r.row_position].riders.length + 1) / 10),
            });
          });

          // Create TTT grid (positions 1-10)
          rows = Array.from({ length: 10 }, (_, i) => {
            const position = i + 1;
            const rule = scoringRules?.find((r) => r.place === position);
            const teamData = teamResults[position];
            const pointsPerRider = Math.round((rule?.points || 0) / tttRidersCount);
            
            return {
              position,
              coureur_id: null,
              coureur_nom: null,
              coureur_equipe: null,
              statut: 'finished' as ResultStatut,
              points: pointsPerRider,
              grid_version: sel_key,
              equipe_id: teamData?.equipe_id || null,
              is_expanded: false,
              team_riders: teamData?.riders || Array.from({ length: tttRidersCount }, (_, idx) => ({
                coureur_id: null,
                coureur_nom: null,
                coureur_equipe: null,
                position_decimal: position + (idx + 1) / 10,
              })),
            };
          });
        } else {
          // Normal Mode: existing logic
          if (!scoringRules || scoringRules.length === 0) {
            // Still display existing results even without scoring rules
            rows = existingResults.map((r: any) => ({
              position: r.position,
              coureur_id: r.coureur_id,
              coureur_nom: r.coureur_nom,
              coureur_equipe: r.coureur_equipe,
              statut: 'finished' as ResultStatut,
              points: r.points || 0,
              grid_version: sel_key,
            }));
          } else {
            // Create full grid based on scoring rules
            const maxPlace = Math.max(...scoringRules.map((r) => r.place));
            rows = Array.from({ length: maxPlace }, (_, i) => {
              const position = i + 1;
              const rule = scoringRules.find((r) => r.place === position);
              // Check if we have existing data for this position
              const existing = existingResults.find((r: any) => r.position === position);
              
              return {
                position,
                coureur_id: existing?.coureur_id || null,
                coureur_nom: existing?.coureur_nom || null,
                coureur_equipe: existing?.coureur_equipe || null,
                statut: 'finished' as ResultStatut,
                points: existing?.points || rule?.points || 0,
                grid_version: sel_key,
              };
            });
          }
        }
      } else {
        console.log('➕ Aucun résultat existant, création grille vide');
        // No existing results - create empty grid from scoring rules
        if (!scoringRules || scoringRules.length === 0) {
          // No scoring rules and no results - set empty state and exit
          setResultRows([]);
          setGridPrepared(true);
          setIsDirty(false);
          setIsLoadingGrid(false);
          return;
        }

        if (isTTT) {
          // TTT Mode: Create empty grid for positions 1-10
          rows = Array.from({ length: 10 }, (_, i) => {
            const position = i + 1;
            const rule = scoringRules.find((r) => r.place === position);
            const pointsPerRider = Math.round((rule?.points || 0) / tttRidersCount);
            
            return {
              position,
              coureur_id: null,
              coureur_nom: null,
              coureur_equipe: null,
              statut: "finished" as ResultStatut,
              points: pointsPerRider,
              grid_version: sel_key,
              equipe_id: null,
              is_expanded: false,
              team_riders: Array.from({ length: tttRidersCount }, (_, idx) => ({
                coureur_id: null,
                coureur_nom: null,
                coureur_equipe: null,
                position_decimal: position + (idx + 1) / 10,
              })),
            };
          });
        } else {
          // Normal Mode: Create full grid
          const maxPlace = Math.max(...scoringRules.map((r) => r.place));
          rows = Array.from({ length: maxPlace }, (_, i) => {
            const position = i + 1;
            const rule = scoringRules.find((r) => r.place === position);
            return {
              position,
              coureur_id: null,
              coureur_nom: null,
              coureur_equipe: null,
              statut: "finished" as ResultStatut,
              points: rule?.points || 0,
              grid_version: sel_key,
            };
          });
        }
      }

      console.log('📝 Grille finale créée:', rows.length, 'lignes');
      if (newRequestId === currentRequestId || newRequestId > currentRequestId) {
        setResultRows(rows);
        setGridPrepared(true);
        setIsDirty(false);
      }
    } catch (err: any) {
      console.error('Error in handlePrepareGrid:', err);
      toast({
        title: "Erreur",
        description: err.message || "Impossible de charger les résultats",
        variant: "destructive",
      });
    } finally {
      setIsLoadingGrid(false);
    }
  }, [sel_key, scoringRules, isOneDay, isTTT, tttRidersCount, currentStage, currentFinalClassement, course.course_id, course.date_debut, course.date_fin, activeTab]);

  // Auto-prepare grid regardless of scoring rules
  useEffect(() => {
    if (!gridPrepared) {
      handlePrepareGrid();
    }
  }, [sel_key, gridPrepared, handlePrepareGrid]);

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


  const saveMutation = useMutation({
    mutationFn: async () => {
      const etapeNumeroValue = classementType === "Etape" && etapeNumero ? Number(etapeNumero) : null;

      // Get saison_id for race_result_sets
      const { data: phaseData } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', course.phase_id)
        .single();
      
      if (!phaseData) throw new Error("Phase introuvable");

      // Get manager_id for created_by field
      const { data: managerData } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      // Update/create race_result_sets with TTT info
      await leagueClient
        .from('race_result_sets')
        .upsert({
          course_id: course.course_id,
          saison_id: phaseData.saison_id,
          type_classement: classementType,
          etape_numero: etapeNumeroValue,
          is_cancelled: isCancelled,
          is_ttt: isTTT,
          ttt_riders_count: isTTT ? tttRidersCount : null,
          created_by: managerData?.id
        }, {
          onConflict: 'course_id,type_classement,etape_numero',
          ignoreDuplicates: false
        });

      // Save TTT config to course_stage_config for points calculation
      // Allow etapeNumeroValue to be null for one-day races
      if (isTTT && tttRidersCount) {
        await supabase
          .from('course_stage_config')
          .upsert({
            course_id: course.course_id,
            etape_numero: etapeNumeroValue, // null for one-day races
            ttt_riders_per_team: tttRidersCount,
            is_ttt: true
          }, {
            onConflict: 'course_id,etape_numero',
            ignoreDuplicates: false
          });
      }

      // If cancelled, delete all results AND points and return
      if (isCancelled) {
        // 1. Delete race_results
        let query1 = leagueClient
          .from('race_results')
          .delete()
          .eq('course_id', course.course_id)
          .eq('type_classement', classementType);
        
        if (etapeNumeroValue === null) {
          query1 = query1.is('etape_numero', null);
        } else {
          query1 = query1.eq('etape_numero', etapeNumeroValue);
        }
        
        await query1;
        
        // 2. Delete points_ledger
        let query2 = leagueClient
          .from('points_ledger')
          .delete()
          .eq('course_id', course.course_id)
          .eq('type_classement', classementType);
        
        if (etapeNumeroValue === null) {
          query2 = query2.is('etape_numero', null);
        } else {
          query2 = query2.eq('etape_numero', etapeNumeroValue);
        }
        
        await query2;
        
        return { success: true, message: 'Annulation enregistrée' };
      }

      // TTT Mode: prepare team riders for save
      let validRows;
      if (isTTT) {
        // Flatten all team riders from all teams
        validRows = resultRows.flatMap((teamRow) => {
          if (!teamRow.equipe_id || !teamRow.team_riders) return [];
          return teamRow.team_riders
            .filter(r => r.coureur_id)
            .map(r => ({
              coureur_id: r.coureur_id!,
              position: teamRow.position,
              position_decimal: r.position_decimal,
              statut: 'finished' as ResultStatut,
              points: teamRow.points,
              equipe_id: teamRow.equipe_id,
            }));
        });
      } else {
        // Normal Mode: use existing logic
        validRows = resultRows.filter((r) => r.coureur_id);
      }
      
      // Allow save if either:
      // 1. We have valid rows in resultRows
      // 2. OR we have a Super Combatif winner (WT GT only, finals tab)
      const hasSuperCombatif = !isOneDay && activeTab === "finals" && currentFinalClassement === "Combatif" && course.categorie === 'WT GT' && combatifWinner;

      // Snapshot to avoid stale jerseyHolders in this async mutation
      const jerseySnapshot = jerseyHoldersRef.current;
      
      // Check if jersey holders have been set (stage races, stages tab only)
      const hasJerseyHolders = !isOneDay && activeTab === "stages" && etapeNumero && 
        Object.values(jerseySnapshot).some(v => v !== null && v !== undefined);

      // 🔍 DEBUG: Log jersey save conditions
      console.log('🟡 Jersey save check:', {
        isOneDay,
        activeTab,
        etapeNumero,
        currentStage,
        jerseySnapshot,
        hasJerseyHolders,
        validRowsCount: validRows.length,
        hasSuperCombatif,
      });

      if (validRows.length === 0 && !hasSuperCombatif && !hasJerseyHolders) {
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

      // Only process validRows if we have them
      let saveResult = null;
      if (validRows.length > 0) {
        // Validate that saison_id is loaded (required for race_results)
        if (!saisonId) {
          throw new Error("Saison ID not loaded. Cannot save results.");
        }

        if (isTTT) {
          // TTT Mode: Insert directly to race_results with equipe_id and position_decimal
          // First, delete existing results for this stage
          await supabase
            .from('race_results')
            .delete()
            .eq('course_id', course.course_id)
            .eq('type_classement', classementType)
            .eq('etape_numero', etapeNumeroValue);

          // Insert new TTT results with equipe_id and position_decimal
          // Use floor(position_decimal) for position to allow points calculation via standard baremes
          const resultsToInsert = validRows.map((row: any) => ({
            course_id: course.course_id,
            coureur_id: row.coureur_id,
            type_classement: classementType,
            etape_numero: etapeNumeroValue,
            position: Math.floor(row.position_decimal), // Floor decimal position for points calculation
            position_decimal: row.position_decimal,
            statut: row.statut,
            equipe_id: row.equipe_id,
            date_classement: dateClassement,
            saison_id: saisonId,
          }));

          const { error: insertError } = await supabase
            .from('race_results')
            .insert(resultsToInsert);

          if (insertError) throw insertError;
          saveResult = { rows_affected: resultsToInsert.length };
        } else {
          // Normal Mode: use existing RPC function
          const rowsForDb = validRows.map((row: any) => ({
            coureur_id: row.coureur_id!,
            position: Number(row.position),
            statut: row.statut,
          }));

          // Use edge function instead of RPC to trigger push notifications
          const { data, error: saveError } = await supabase.functions.invoke('admin-result-save-lot', {
            body: {
              p_course_id: course.course_id,
              p_type_classement: classementType,
              p_etape_numero: etapeNumeroValue,
              p_rows: rowsForDb,
            }
          });

          if (saveError) throw saveError;
          saveResult = data;
        }
      }

      // Save jersey holders FIRST if on stage race + stages tab (before computing points)
      if (!isOneDay && activeTab === "stages" && etapeNumero) {
        console.log('🔵 Sauvegarde des porteurs de maillots:', {
          courseId: course.course_id,
          etapeNumero: Number(etapeNumero),
          jerseyHolders: jerseySnapshot
        });

        // Simple jersey mappings - no accent issues with "Leader"
        const jerseyMappings: Array<{ type: ClassementType; key: JerseyType }> = [
          { type: 'Porteur Leader', key: 'general' },
          { type: 'Porteur Vert', key: 'vert' },
          { type: 'Porteur Montagne', key: 'montagne' },
          { type: 'Porteur Jeune', key: 'jeune' },
          { type: 'Porteur Combattif', key: 'combattif' },
        ];

        for (const { type, key } of jerseyMappings) {
          const coureurId = jerseySnapshot[key];

          if (coureurId) {
            // Use edge function (no push for jersey holders - filtered by edge function)
            const { error: jerseyError } = await supabase.functions.invoke('admin-result-save-lot', {
              body: {
                p_course_id: course.course_id,
                p_type_classement: type,
                p_etape_numero: Number(etapeNumero),
                p_rows: [{ coureur_id: coureurId, position: 1, statut: 'finished' as ResultStatut }],
              }
            });
            if (jerseyError) {
              console.error(`❌ Error saving ${type}:`, jerseyError);
              toast({
                title: `⚠️ Erreur porteur ${key}`,
                description: `Impossible de sauvegarder ${type}: ${jerseyError.message}`,
                variant: "destructive",
              });
            } else {
              console.log(`✅ Jersey ${type} saved for coureur ${coureurId}`);
            }
          } else {
            // Delete existing holder if cleared
            const { error: deleteError } = await supabase
              .from('race_results')
              .delete()
              .eq('course_id', course.course_id)
              .eq('type_classement', type)
              .eq('etape_numero', Number(etapeNumero));
            if (deleteError) {
              console.error(`❌ Error clearing ${type}:`, deleteError);
              toast({
                title: `⚠️ Erreur suppression ${key}`,
                description: `Impossible de supprimer ${type}: ${deleteError.message}`,
                variant: "destructive",
              });
            }
          }
        }
      }

      // Now recompute points for this course (after jersey holders are saved)
      const { data: computeData, error: computeError } = await supabase.functions.invoke('compute-points', {
        body: { course_id: course.course_id }
      });
      
      if (computeError) {
        console.error('❌ Error recomputing points after save:', computeError);
        toast({
          title: "⚠️ Erreur calcul de points",
          description: "Les résultats sont sauvegardés mais les points n'ont pas été recalculés. Utilisez l'onglet 'Recalcul Points'.",
          variant: "destructive",
        });
      } else {
        console.log('✅ Points recalculés avec succès:', computeData);
        
        // Post-compute verification: check points_ledger has entries
        const { count: ledgerCount, error: ledgerError } = await supabase
          .from('points_ledger')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.course_id);
        
        if (ledgerError) {
          console.error('❌ Error checking points_ledger:', ledgerError);
        }
        
        if (!ledgerError && (ledgerCount ?? 0) === 0) {
          console.warn('⚠️ Points ledger vide après compute-points! Tentative de retry...');
          
          // Retry once
          const { error: retryError } = await supabase.functions.invoke('compute-points', {
            body: { course_id: course.course_id }
          });
          
          const { count: retryCount } = await supabase
            .from('points_ledger')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.course_id);
          
          if (retryError || (retryCount ?? 0) === 0) {
            toast({
              title: "⚠️ Points non attribués",
              description: "Les résultats sont enregistrés mais le calcul de points semble avoir échoué. Vérifiez dans l'onglet 'Recalcul Points'.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "✅ Points calculés (2ème tentative)",
              description: `${retryCount} lignes de points attribuées.`,
            });
          }
        } else {
          toast({
            title: "✅ Points calculés",
            description: `${ledgerCount} lignes de points attribuées.`,
          });
        }
        
        // Reset manual TTT flag after successful save
        tttManuallySet.current = false;
      }


      // Save Combatif winner if on finals tab for WT GT
      if (!isOneDay && activeTab === "finals" && currentFinalClassement === "Combatif" && course.categorie === 'WT GT' && combatifWinner) {
        // Use edge function (no push for Combatif - filtered by edge function)
        await supabase.functions.invoke('admin-result-save-lot', {
          body: {
            p_course_id: course.course_id,
            p_type_classement: 'Combatif' as ClassementType,
            p_etape_numero: null,
            p_rows: [{ coureur_id: combatifWinner, position: 1, statut: 'finished' as ResultStatut }],
          }
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
      queryClient.invalidateQueries({ queryKey: ["jersey-holders"] });
      queryClient.invalidateQueries({ queryKey: ["results-course-table"] });

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

  const resetMutation = useMutation({
    mutationFn: async () => {
      const etapeNumeroValue = classementType === "Etape" && etapeNumero ? Number(etapeNumero) : null;
      
      // Delete race_results for this specific classification
      let query1 = leagueClient
        .from('race_results')
        .delete()
        .eq('course_id', course.course_id)
        .eq('type_classement', classementType);
      
      if (etapeNumeroValue === null) {
        query1 = query1.is('etape_numero', null);
      } else {
        query1 = query1.eq('etape_numero', etapeNumeroValue);
      }
      
      const { error: resultsError } = await query1;

      if (resultsError) throw resultsError;

      // Delete points_ledger for this specific classification
      let query2 = leagueClient
        .from('points_ledger')
        .delete()
        .eq('course_id', course.course_id)
        .eq('type_classement', classementType);
      
      if (etapeNumeroValue === null) {
        query2 = query2.is('etape_numero', null);
      } else {
        query2 = query2.eq('etape_numero', etapeNumeroValue);
      }
      
      const { error: pointsError } = await query2;

      if (pointsError) throw pointsError;

      // Update race_result_sets to mark as not cancelled
      let query3 = leagueClient
        .from('race_result_sets')
        .update({ is_cancelled: false })
        .eq('course_id', course.course_id)
        .eq('type_classement', classementType);
      
      if (etapeNumeroValue === null) {
        query3 = query3.is('etape_numero', null);
      } else {
        query3 = query3.eq('etape_numero', etapeNumeroValue);
      }
      
      await query3;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-completion"] });
      queryClient.invalidateQueries({ queryKey: ["results-status"] });
      queryClient.invalidateQueries({ queryKey: ["manager-standings"] });
      queryClient.invalidateQueries({ queryKey: ["top-riders"] });
      queryClient.invalidateQueries({ queryKey: ["recent-points"] });
      queryClient.invalidateQueries({ queryKey: ["rankings-kpis"] });

      const label = activeTab === "stages" ? `Étape ${currentStage}` : classementType;
      toast({
        title: "✅ Réinitialisation effectuée",
        description: `${label} - Tous les résultats et points ont été supprimés`,
      });

      // Reset local state
      setResultRows([]);
      setGridPrepared(false);
      setIsDirty(false);
      setIsCancelled(false);
      setResetDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // PCS Import handler
  const handlePcsImport = async (pcsSlugOverride?: string) => {
    const year = new Date(course.date_debut).getFullYear();
    const { results, error } = await importFromPcs({
      courseId: course.course_id,
      year,
      typeClassement: classementType,
      etapeNumero: etapeNumero,
      pcsSlugOverride,
    });

    if (error?.type === 'slug_error') {
      // Extract slug from error or course_id
      const slugUsed = error.slugUsed || course.course_id.replace(/^(.+)-[a-z0-9]{8}$/, '$1').replace(/_/g, '-');
      setPcsSlugError({ message: error.message, slugUsed });
      setPcsSlugDialogOpen(true);
      return;
    }

    if (!results || results.length === 0) return;

    // Map scraped results into the existing grid
    setResultRows((prev) => {
      const newRows = [...prev];
      for (const result of results) {
        const idx = newRows.findIndex((r) => r.position === result.position);
        if (idx >= 0 && result.matched_coureur_id) {
          newRows[idx] = {
            ...newRows[idx],
            coureur_id: result.matched_coureur_id,
            coureur_nom: result.matched_coureur_nom,
          };
        }
      }
      return newRows;
    });
    setIsDirty(true);
    setGridPrepared(true);
    setPcsSlugDialogOpen(false);

    // Auto-fill jersey holders for stage races in "Etape" mode
    if (!isOneDay && activeTab === "stages" && classementType === "Etape") {
      const jerseyClassifications = [
        { type: "General", jersey: "general" as JerseyType },
        { type: "Points", jersey: "vert" as JerseyType },
        { type: "Montagne", jersey: "montagne" as JerseyType },
        { type: "Jeune", jersey: "jeune" as JerseyType },
      ];

      const jerseyResults = await Promise.allSettled(
        jerseyClassifications.map(({ type }) =>
          importFromPcs({
            courseId: course.course_id,
            year,
            typeClassement: type,
            etapeNumero: currentStage,
            pcsSlugOverride,
          })
        )
      );

      let filled = 0;
      jerseyResults.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value.results && result.value.results.length > 0) {
          const leader = result.value.results[0];
          if (leader.matched_coureur_id) {
            setJerseyHolders((prev) => ({
              ...prev,
              [jerseyClassifications[idx].jersey]: leader.matched_coureur_id,
            }));
            filled++;
          }
        }
      });

      if (filled > 0) {
        toast({
          title: `🏅 ${filled}/4 maillots remplis automatiquement`,
          description: filled < 4
            ? `${4 - filled} maillot(s) non trouvé(s) sur PCS`
            : "Tous les maillots ont été remplis !",
        });
      }
    }
  };

  const handleRiderChange = (index: number, riderId: string | null, riderName: string | null) => {
    setResultRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, coureur_id: riderId, coureur_nom: riderName } : row
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

  // TTT specific handlers
  const handleTeamChange = (index: number, equipeId: string | null) => {
    setResultRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const rule = scoringRules?.find((r) => r.place === row.position);
        const pointsPerRider = Math.round((rule?.points || 0) / tttRidersCount);
        
        // Initialize team riders array
        const teamRiders = equipeId ? Array.from({ length: tttRidersCount }, (_, idx) => ({
          coureur_id: null,
          coureur_nom: null,
          coureur_equipe: null,
          position_decimal: row.position + (idx + 1) / 10,
        })) : [];
        
        return {
          ...row,
          equipe_id: equipeId,
          team_riders: teamRiders,
          points: pointsPerRider,
        };
      })
    );
    setIsDirty(true);
  };

  const handleToggleExpand = (index: number) => {
    setResultRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, is_expanded: !row.is_expanded } : row
      )
    );
  };

  const handleTeamRiderChange = (teamIndex: number, riderIndex: number, riderId: string | null, riderName: string | null) => {
    setResultRows((prev) =>
      prev.map((row, i) => {
        if (i !== teamIndex || !row.team_riders) return row;
        const newTeamRiders = [...row.team_riders];
        newTeamRiders[riderIndex] = {
          ...newTeamRiders[riderIndex],
          coureur_id: riderId,
          coureur_nom: riderName,
        };
        return {
          ...row,
          team_riders: newTeamRiders,
        };
      })
    );
    setIsDirty(true);
  };

  const validLinesCount = isTTT 
    ? resultRows.reduce((count, row) => count + (row.team_riders?.filter(r => r.coureur_id).length || 0), 0)
    : resultRows.filter((r) => r.coureur_id).length;

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
              {/* TTT Mode Checkbox - For Stages and One-Day races */}
              {(activeTab === "stages" || (isOneDay && activeTab === "finals")) && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ttt-checkbox"
                    checked={isTTT}
                    onCheckedChange={(checked) => {
                      setIsTTT(checked === true);
                      setIsDirty(true);
                      tttManuallySet.current = true; // Mark as manually set to prevent DB override
                      // Reset grid when switching TTT mode
                      setResultRows([]);
                      setGridPrepared(false);
                    }}
                    disabled={isCancelled}
                  />
                  <label htmlFor="ttt-checkbox" className="text-sm font-medium cursor-pointer">
                    TTT
                  </label>
                </div>
              )}
              
              {/* TTT Riders Count Input */}
              {isTTT && (activeTab === "stages" || (isOneDay && activeTab === "finals")) && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Nb coureurs:</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={tttRidersCount}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= 1 && value <= 10) {
                        setTttRidersCount(value);
                        setIsDirty(true);
                      }
                    }}
                    className="w-20"
                  />
                </div>
              )}
              
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

          {/* Loading Indicator */}
          {isLoadingGrid && (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin mr-3 text-primary" />
              <span className="text-sm text-muted-foreground">Chargement de la grille...</span>
            </div>
          )}

          {/* Results Table - Normal Mode */}
          {!isLoadingGrid && gridPrepared && !isTTT && (
            <div key={sel_key} className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                     <tr>
                       <th className="px-4 py-3 text-left text-sm font-medium w-20">Pos</th>
                       <th className="px-4 py-3 text-left text-sm font-medium">Coureur</th>
                       <th className="px-4 py-3 text-left text-sm font-medium w-32">Équipe</th>
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
                        handleRiderChange(index, coureur.coureur_id, coureur.coureur_nom);
                      } else {
                        handleRiderChange(index, null, null);
                      }
                    }}
                    placeholder={row.coureur_nom || "Sélectionner un coureur..."}
                    showTakenRiders={true}
                    disabled={isCancelled}
                    context="super-admin"
                  />
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {row.coureur_equipe || '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-medium">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Results Table - TTT Mode */}
          {!isLoadingGrid && gridPrepared && isTTT && saisonId && (
            <div key={sel_key} className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                     <tr>
                       <th className="px-4 py-3 text-left text-sm font-medium w-20">Pos</th>
                       <th className="px-4 py-3 text-left text-sm font-medium">Équipe / Coureurs</th>
                       <th className="px-4 py-3 text-right text-sm font-medium w-24">Points</th>
                       <th className="px-4 py-3 text-center text-sm font-medium w-24">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resultRows.slice(0, 10).map((row, index) => (
                      <>
                        {/* Team Row */}
                        <tr key={`team-${index}`} className={cn("hover:bg-muted/50", isCancelled && "opacity-50 pointer-events-none")}>
                          <td className="px-4 py-2 text-sm font-medium">{row.position}</td>
                          <td className="px-4 py-2">
                            <EquipeCombobox
                              saisonId={saisonId}
                              value={row.equipe_id || undefined}
                              onValueChange={(equipeId) => handleTeamChange(index, equipeId || null)}
                              disabled={isCancelled}
                            />
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-muted-foreground">
                            {scoringRules?.find((r) => r.place === row.position)?.points || 0}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {row.equipe_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleExpand(index)}
                              >
                                {row.is_expanded ? "Réduire" : "Développer"}
                                <Badge variant="secondary" className="ml-2">
                                  {row.team_riders?.filter(r => r.coureur_id).length || 0}/{tttRidersCount}
                                </Badge>
                              </Button>
                            )}
                          </td>
                        </tr>
                        
                        {/* Team Riders Sub-rows */}
                        {row.is_expanded && row.team_riders?.map((rider, riderIndex) => (
                          <tr key={`rider-${index}-${riderIndex}`} className="bg-muted/30">
                            <td className="px-4 py-2 text-xs text-muted-foreground pl-8">
                              {row.position}.{riderIndex + 1}
                            </td>
                            <td className="px-4 py-2 pl-8">
                              <CoureursCombobox
                                phaseId={course.phase_id}
                                value={rider.coureur_id}
                                onSelect={(coureur) => {
                                  if (coureur) {
                                    handleTeamRiderChange(index, riderIndex, coureur.coureur_id, coureur.coureur_nom);
                                  } else {
                                    handleTeamRiderChange(index, riderIndex, null, null);
                                  }
                                }}
                                placeholder={rider.coureur_nom || "Sélectionner un coureur..."}
                                showTakenRiders={true}
                                disabled={isCancelled}
                                context="super-admin"
                              />
                            </td>
                            <td className="px-4 py-2 text-right text-sm font-medium">{row.points}</td>
                            <td></td>
                          </tr>
                        ))}
                      </>
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
                context="super-admin"
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
                {isTTT 
                  ? `${validLinesCount} coureurs / ${resultRows.filter(r => r.equipe_id).length} équipes`
                  : `${validLinesCount} / ${resultRows.length} lignes valides`
                }
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

              <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Réinitialiser
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer la réinitialisation</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr de vouloir supprimer tous les résultats et points de{" "}
                      <strong>
                        {activeTab === "stages" && !isOneDay
                          ? `l'Étape ${currentStage}`
                          : classementType}
                      </strong>{" "}
                      pour <strong>{course.course_nom}</strong> ?
                      <br />
                      <br />
                      Cette action est irréversible et supprimera :
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Tous les résultats de course (race_results)</li>
                        <li>Tous les points attribués (points_ledger)</li>
                        {activeTab === "stages" && !isOneDay && (
                          <li>Les porteurs de maillots de cette étape</li>
                        )}
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => resetMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={resetMutation.isPending}
                    >
                      {resetMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Suppression...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer définitivement
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="outline"
                onClick={() => handlePcsImport()}
                disabled={isPcsImporting || isCancelled}
              >
                {isPcsImporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Import PCS...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" />Importer PCS</>
                )}
              </Button>

              <PcsSlugDialog
                open={pcsSlugDialogOpen}
                onOpenChange={setPcsSlugDialogOpen}
                slugUsed={pcsSlugError.slugUsed}
                errorMessage={pcsSlugError.message}
                onRetry={(newSlug) => handlePcsImport(newSlug)}
                isRetrying={isPcsImporting}
              />

              <Button
                variant="outline"
                onClick={() => setExportDialogOpen(true)}
              >
                <Camera className="h-4 w-4 mr-2" />
                Exporter JPEG
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

      <ExportResultsImage
        course={course}
        currentStage={currentStage}
        currentClassement={
          course.type_course === "One day" 
            ? "General"
            : (activeTab === "stages" ? "Etape" : currentFinalClassement)
        }
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
    </div>
  );
};


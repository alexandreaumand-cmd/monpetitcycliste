import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLeagueClient } from "@/lib/supabase/leagueClient";
import { toast } from "sonner";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";
import { X, ChevronLeft, ChevronRight, Save, Check, Info, MessageSquare, Share2 } from "lucide-react";
import { ExportResultsImage } from "./ExportResultsImage";
import { normalizeCourseType, isStageRace } from "@/lib/courseType";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { JerseyHoldersInput } from "./JerseyHoldersInput";
import { cn } from "@/lib/utils";

type Course = {
  course_id: string;
  course_nom: string;
  categorie: string;
  type_course: string;
  date_debut: string;
  date_fin: string;
  nb_etapes: number;
  phase_id: string;
};

type ClassementType = "Etape" | "General" | "Points" | "Montagne" | "Jeune" | "Combatif";
type StatutType = "finished" | "dnf" | "dns" | "dsq";

type ResultRow = {
  position: number;
  coureur_id: string | null;
  coureur_nom: string | null;
  statut: StatutType;
  points: number;
};

type ScoringRule = {
  place: number;
  points: number;
};

export const ResultsEntryStudioMobile = ({
  course,
  mode,
  onClose,
}: {
  course: Course;
  mode: 'create' | 'edit';
  onClose: () => void;
}) => {
  const [currentStage, setCurrentStage] = useState(1);
  const courseIsStageRace = isStageRace(course.type_course);
  const [currentClassement, setCurrentClassement] = useState<ClassementType>(
    courseIsStageRace ? "Etape" : "General"
  );
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [isCancelled, setIsCancelled] = useState(false);
  const [jerseyHolders, setJerseyHolders] = useState<{
    general: string | null;
    vert: string | null;
    montagne: string | null;
    jeune: string | null;
    combattif: string | null;
  }>({
    general: null,
    vert: null,
    montagne: null,
    jeune: null,
    combattif: null,
  });
  const [etapeOpen, setEtapeOpen] = useState(true);
  const [gcOpen, setGcOpen] = useState(!courseIsStageRace);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [montagneOpen, setMontagneOpen] = useState(false);
  const [jeuneOpen, setJeuneOpen] = useState(false);
  const [combatifOpen, setCombatifOpen] = useState(false);
  const [combatifWinner, setCombatifWinner] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const leagueClient = useLeagueClient();

  // Fetch scoring rules using normalized views (same as desktop)
  const { data: scoringRules } = useQuery({
    queryKey: ['scoring-rules-mobile', course.course_id, currentClassement],
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
      const typeClassement = typeMap[currentClassement] || currentClassement;

      // 3. Récupérer les barèmes directement depuis scoring_rules_saisons
      const { data: rulesData, error: rulesError } = await supabase
        .from('scoring_rules_saisons')
        .select('place, points')
        .eq('saison_id', phaseData.saison_id)
        .eq('categorie', course.categorie)
        .eq('type_classement', typeClassement as any)
        .order('place');

      if (rulesError) {
        console.error('Error fetching scoring rules:', rulesError);
        return [];
      }

      return (rulesData || []) as ScoringRule[];
    },
  });

  // Memoize loadResults with all dependencies
  const loadResults = useCallback(async () => {
    console.log('🔧 loadResults called', { currentClassement, currentStage });
    if (!scoringRules || scoringRules.length === 0) {
      console.log('⚠️ Pas de barème disponible');
      return;
    }

    // Load cancellation status
    const etapeNumeroValue = currentClassement === 'Etape' ? currentStage : null;
    const { data: resultSetData } = await supabase
      .from('race_result_sets')
      .select('is_cancelled')
      .eq('course_id', course.course_id)
      .eq('type_classement', currentClassement)
      .eq('etape_numero', etapeNumeroValue)
      .maybeSingle();

    setIsCancelled(resultSetData?.is_cancelled || false);

    let query = supabase
      .from('race_results')
      .select('*, coureurs(nom)')
      .eq('course_id', course.course_id)
      .eq('type_classement', currentClassement);
    
    if (currentClassement === 'Etape') {
      query = query.eq('etape_numero', currentStage);
    } else {
      query = query.is('etape_numero', null);
    }
    
    const { data: existingData } = await query.order('position', { ascending: true, nullsFirst: false });
    console.log('📊 Résultats existants chargés:', existingData?.length || 0);
    
    const maxPlace = Math.max(...scoringRules.map(sr => sr.place));
    const rows: ResultRow[] = [];

    const finishedResults = existingData?.filter(r => r.statut === 'finished' && r.position) || [];
    console.log('✅ Résultats "finished" avec position:', finishedResults.length);
    
    // Create rows based on scoring rules
    for (let i = 1; i <= maxPlace; i++) {
      const existing = finishedResults.find(r => r.position === i);
      const points = scoringRules.find(sr => sr.place === i)?.points || 0;
      
      rows.push({
        position: i,
        coureur_id: existing?.coureur_id || null,
        coureur_nom: existing ? (existing.coureurs as any)?.nom || null : null,
        statut: 'finished' as StatutType,
        points,
      });
    }

    // Add non-finished results at the end
    const nonFinishedResults = existingData?.filter(r => r.statut !== 'finished') || [];
    nonFinishedResults.forEach(r => {
      rows.push({
        position: 0,
        coureur_id: r.coureur_id,
        coureur_nom: (r.coureurs as any)?.nom || null,
        statut: r.statut as StatutType,
        points: 0,
      });
    });

    console.log('📝 Grille finale créée:', rows.length, 'lignes');
    setResultRows(rows);
  }, [scoringRules, currentClassement, currentStage, course.course_id]);

  // Load existing results when scoring rules are available - only for current classement
  useEffect(() => {
    if (scoringRules && scoringRules.length > 0) {
      loadResults();
    }
  }, [currentStage, scoringRules, loadResults]);

  // Load jersey holders independently of scoring rules
  useEffect(() => {
    if (courseIsStageRace && currentClassement === 'Etape') {
      loadJerseyHolders();
    }
  }, [course.course_id, currentStage, currentClassement]);

  // Load Combatif winner for WT GT
  useEffect(() => {
    if (courseIsStageRace && currentClassement === 'Combatif' && course.categorie === 'WT GT') {
      loadCombatifWinner();
    }
  }, [course.course_id, currentClassement]);

  const loadCombatifWinner = async () => {
    const { data: combatifData } = await supabase
      .from('race_results')
      .select('coureur_id')
      .eq('course_id', course.course_id)
      .eq('type_classement', 'Combatif')
      .is('etape_numero', null)
      .eq('position', 1)
      .maybeSingle();

    setCombatifWinner(combatifData?.coureur_id || null);
  };


  const loadJerseyHolders = async () => {
    const jerseyMappings: Array<{ key: 'general' | 'vert' | 'montagne' | 'jeune' | 'combattif'; type: string }> = [
      { key: 'general', type: 'Porteur Général' },
      { key: 'vert', type: 'Porteur Vert' },
      { key: 'montagne', type: 'Porteur Montagne' },
      { key: 'jeune', type: 'Porteur Jeune' },
      { key: 'combattif', type: 'Porteur Combattif' },
    ];

    const newJerseyHolders: typeof jerseyHolders = {
      general: null,
      vert: null,
      montagne: null,
      jeune: null,
      combattif: null,
    };

    for (const { key, type } of jerseyMappings) {
      const { data: jerseyData } = await supabase
        .from('race_results')
        .select('coureur_id')
        .eq('course_id', course.course_id)
        .eq('type_classement', type as any)
        .eq('etape_numero', currentStage)
        .eq('position', 1)
        .maybeSingle();

      if (jerseyData?.coureur_id) {
        newJerseyHolders[key] = jerseyData.coureur_id;
      }
    }

    setJerseyHolders(newJerseyHolders);
  };

  const handleRiderChange = (index: number, coureur: any) => {
    setResultRows(prev => prev.map((row, i) => 
      i === index 
        ? { 
            ...row, 
            coureur_id: coureur?.coureur_id || null, 
            coureur_nom: coureur?.coureur_nom || null 
          }
        : row
    ));
  };

  const handleStatutChange = (index: number, statut: StatutType) => {
    setResultRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const points = statut === 'finished' 
        ? (scoringRules?.find(sr => sr.place === row.position)?.points || 0) 
        : 0;
      return { ...row, statut, points };
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const etapeNumeroValue = currentClassement === 'Etape' ? currentStage : null;

      // Update cancellation status
      await leagueClient
        .from('race_result_sets')
        .update({ is_cancelled: isCancelled })
        .eq('course_id', course.course_id)
        .eq('type_classement', currentClassement)
        .eq('etape_numero', etapeNumeroValue);

      // If cancelled, delete all results and return
      if (isCancelled) {
        await leagueClient
          .from('race_results')
          .delete()
          .eq('course_id', course.course_id)
          .eq('type_classement', currentClassement)
          .eq('etape_numero', etapeNumeroValue);
        
        return { success: true, message: 'Annulation enregistrée' };
      }

      // Otherwise, save results normally
      const validRows = resultRows.filter(r => r.coureur_id);
      
      // Allow save if either:
      // 1. We have valid rows in resultRows
      // 2. OR we have a Super Combatif winner (WT GT only)
      const hasSuperCombatif = courseIsStageRace && course.categorie === 'WT GT' && currentClassement === 'Combatif' && combatifWinner;

      if (validRows.length === 0 && !hasSuperCombatif) {
        throw new Error("Aucun résultat à sauvegarder");
      }

      // Skip scoring lookup if we're only saving Super Combatif
      let scoringMap = new Map();
      let phaseData = null;
      let riderManagerMap = new Map<string, string | null>();
      let dateClassement = '';

      if (validRows.length > 0) {
        const { data: serverScoringRules, error: rulesError } = await supabase
        .from('scoring_rules_norm')
        .select('place, points')
        .eq('cat_canon', course.categorie)
        .eq('type_canon', currentClassement)
        .order('place');

        if (rulesError) throw rulesError;
        if (!serverScoringRules?.length) {
          console.warn(`⚠️ Aucun barème trouvé pour ${currentClassement}`);
          // Continue with empty scoring map
        }

        scoringMap = new Map(serverScoringRules.map(sr => [sr.place, sr.points]));
      }

      // Get saison_id from phase
      const { data: phaseDataResult } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', course.phase_id)
        .single();

      phaseData = phaseDataResult;

      if (!phaseData?.saison_id) {
        throw new Error('Impossible de trouver la saison pour cette course');
      }

      dateClassement = currentClassement === 'Etape'
        ? new Date(new Date(course.date_debut).getTime() + (currentStage - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : (course.date_fin || course.date_debut);

      if (validRows.length > 0) {
        for (const row of validRows) {
          const { data: roster } = await leagueClient
            .from('rosters')
            .select('manager_id')
            .eq('phase_id', course.phase_id)
            .eq('coureur_id', row.coureur_id!)
            .maybeSingle();
          
          riderManagerMap.set(row.coureur_id!, roster?.manager_id || null);
        }

        const resultsToUpsert = validRows.map(row => {
        const isFinished = row.statut === 'finished';
        const positionValue = isFinished && row.position > 0 ? row.position : null;
        const points = isFinished && row.position > 0 ? (scoringMap.get(row.position) || 0) : 0;
        
        return {
          course_id: course.course_id,
          coureur_id: row.coureur_id!,
          type_classement: currentClassement,
          etape_numero: currentClassement === 'Etape' ? currentStage : null,
          position: positionValue,
          statut: row.statut,
          date_classement: dateClassement,
          manager_id: riderManagerMap.get(row.coureur_id!),
          points,
          saison_id: phaseData.saison_id,
        };
        });

        // Delete existing results before upserting to avoid position conflicts
        let deleteResultsQuery = leagueClient
          .from('race_results')
          .delete()
          .eq('course_id', course.course_id)
          .eq('type_classement', currentClassement);
        
        if (currentClassement === 'Etape') {
          deleteResultsQuery = deleteResultsQuery.eq('etape_numero', currentStage);
        } else {
          deleteResultsQuery = deleteResultsQuery.is('etape_numero', null);
        }

        const { error: deleteError } = await deleteResultsQuery;

        if (deleteError) throw deleteError;

        const { error: resultsError } = await leagueClient
          .from('race_results')
          .upsert(resultsToUpsert, {
            onConflict: 'course_id,type_classement,etape_numero,coureur_id',
          });

        if (resultsError) throw resultsError;
      }

      // Save jersey holders
      if (courseIsStageRace && currentClassement === 'Etape') {
        const jerseyMappings: Array<{ key: 'general' | 'vert' | 'montagne' | 'jeune' | 'combattif'; type: string }> = [
          { key: 'general', type: 'Porteur Général' },
          { key: 'vert', type: 'Porteur Vert' },
          { key: 'montagne', type: 'Porteur Montagne' },
          { key: 'jeune', type: 'Porteur Jeune' },
          { key: 'combattif', type: 'Porteur Combattif' },
        ];

        for (const { key, type } of jerseyMappings) {
          const coureurId = jerseyHolders[key];
          if (!coureurId) continue;

          // Récupérer le manager_id pour ce coureur spécifiquement
          const { data: roster } = await leagueClient
            .from('rosters')
            .select('manager_id')
            .eq('phase_id', course.phase_id)
            .eq('coureur_id', coureurId)
            .maybeSingle();

          await leagueClient.from('race_results').upsert({
            course_id: course.course_id,
            coureur_id: coureurId,
            type_classement: type as any,
            etape_numero: currentStage,
            position: 1,
            statut: 'finished' as const,
            date_classement: dateClassement,
            manager_id: roster?.manager_id || null,
            points: 0,
            saison_id: phaseData.saison_id,
          } as any, {
            onConflict: 'course_id,type_classement,etape_numero,coureur_id',
          });
        }
      }

      // Save Combatif winner for WT GT
      if (courseIsStageRace && currentClassement === 'Combatif' && course.categorie === 'WT GT' && combatifWinner) {
        // Get manager for combatif winner
        const { data: combatifRoster } = await leagueClient
          .from('rosters')
          .select('manager_id')
          .eq('phase_id', course.phase_id)
          .eq('coureur_id', combatifWinner)
          .maybeSingle();

        await leagueClient.from('race_results').upsert({
          course_id: course.course_id,
          coureur_id: combatifWinner,
          type_classement: 'Combatif' as any,
          etape_numero: null,
          position: 1,
          statut: 'finished' as const,
          date_classement: dateClassement,
          manager_id: combatifRoster?.manager_id || null,
          points: 0,
          saison_id: phaseData!.saison_id,
        } as any, {
          onConflict: 'course_id,type_classement,etape_numero,coureur_id',
        });
      }

      // Delete and reinsert points
      let deleteQuery = leagueClient
        .from('points_ledger')
        .delete()
        .eq('course_id', course.course_id)
        .eq('type_classement', currentClassement);

      if (currentClassement === 'Etape') {
        deleteQuery = deleteQuery.eq('etape_numero', currentStage);
      } else {
        deleteQuery = deleteQuery.is('etape_numero', null);
      }

      await deleteQuery;

      const pointsToInsert = [];
      for (const row of validRows) {
        if (row.statut !== 'finished' || row.position === 0) continue;

        const serverPoints = scoringMap.get(row.position) || 0;
        if (serverPoints === 0) continue;

        const managerId = riderManagerMap.get(row.coureur_id!);
        if (managerId) {
          pointsToInsert.push({
            course_id: course.course_id,
            coureur_id: row.coureur_id!,
            manager_id: managerId,
            phase_id: course.phase_id,
            type_classement: currentClassement,
            etape_numero: currentClassement === 'Etape' ? currentStage : null,
            points: serverPoints,
          });
        }
      }

      if (pointsToInsert.length > 0) {
        await leagueClient.from('points_ledger').insert(pointsToInsert);
      }
    },
    onSuccess: (data: any) => {
      setLastSaved(new Date());
      if (data.message === 'Annulation enregistrée') {
        toast.success("Annulation enregistrée");
      } else {
        toast.success("Résultats enregistrés");
      }
      queryClient.invalidateQueries({ queryKey: ['results-status'] });
      loadResults();
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleNextStage = () => {
    if (currentStage < course.nb_etapes) {
      setCurrentStage(currentStage + 1);
    }
  };

  const handlePrevStage = () => {
    if (currentStage > 1) {
      setCurrentStage(currentStage - 1);
    }
  };

  // Calculate visible stages for optimized navigator
  const getVisibleStages = (): (number | string)[] => {
    if (course.nb_etapes <= 7) {
      return Array.from({ length: course.nb_etapes }, (_, i) => i + 1);
    }
    
    const stages: (number | string)[] = [];
    if (currentStage <= 4) {
      stages.push(...[1, 2, 3, 4, 5, '...', course.nb_etapes]);
    } else if (currentStage >= course.nb_etapes - 3) {
      stages.push(...[1, '...', course.nb_etapes - 4, course.nb_etapes - 3, course.nb_etapes - 2, course.nb_etapes - 1, course.nb_etapes]);
    } else {
      stages.push(...[1, '...', currentStage - 1, currentStage, currentStage + 1, '...', course.nb_etapes]);
    }
    return stages;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b">
      <div className="flex items-center justify-between p-3">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <h2 className="font-bold text-sm truncate">{course.course_nom}</h2>
          {courseIsStageRace && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>Étape {currentStage}/{course.nb_etapes}</span>
              {currentClassement && (
                <>
                  <span>•</span>
                  <span className="text-green-600 font-medium">
                    {resultRows.filter(r => r.coureur_id && r.statut === 'finished').length}/{resultRows.filter(r => r.position > 0).length}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setExportDialogOpen(true)}
            className="relative"
          >
            <Share2 className="h-5 w-5 text-blue-600" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="relative"
          >
            <Save className={cn(
              "h-5 w-5 transition-colors",
              saveMutation.isPending && "text-green-600"
            )} />
          </Button>
        </div>
      </div>
        
        {/* Barre de progression */}
        {courseIsStageRace && (
          <div className="h-1 bg-muted">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300"
              style={{ 
                width: `${(resultRows.filter(r => r.coureur_id && r.statut === 'finished').length / Math.max(resultRows.filter(r => r.position > 0).length, 1)) * 100}%` 
              }}
            />
          </div>
        )}

        {/* Stage navigator */}
        {courseIsStageRace && (
          <div className="flex items-center justify-between px-3 pb-2 gap-2">
            <Button 
              variant="outline" 
              size="icon"
              className="h-7 w-7"
              onClick={handlePrevStage}
              disabled={currentStage === 1}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            
            <div className="flex-1 flex gap-1 justify-center overflow-x-auto scrollbar-hide">
              {getVisibleStages().map((stage, idx) => (
                stage === '...' ? (
                  <span key={`ellipsis-${idx}`} className="min-w-[28px] h-7 flex items-center justify-center text-muted-foreground text-xs">
                    ...
                  </span>
                ) : (
                  <button
                    key={stage}
                    onClick={() => setCurrentStage(stage as number)}
                    className={cn(
                      "min-w-[28px] h-7 rounded-full text-xs font-medium transition-all",
                      stage === currentStage
                        ? 'bg-primary text-primary-foreground shadow-md scale-110'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {stage}
                  </button>
                )
              ))}
            </div>

            <Button 
              variant="outline" 
              size="icon"
              className="h-7 w-7"
              onClick={handleNextStage}
              disabled={currentStage === course.nb_etapes}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Cancelled checkbox */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <Checkbox
            id="cancelled-checkbox-mobile"
            checked={isCancelled}
            onCheckedChange={async (checked) => {
              setIsCancelled(checked === true);
              if (checked) {
                setResultRows(prev => prev.map(row => ({
                  ...row,
                  coureur_id: null,
                  coureur_nom: null,
                })));
                
                // Create/update race_result_set immediately
                const etapeNumeroValue = currentClassement === 'Etape' ? currentStage : null;
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
                      type_classement: currentClassement,
                      etape_numero: etapeNumeroValue,
                      is_cancelled: true,
                      created_by: managerData.id
                    }, {
                      onConflict: 'course_id,type_classement,etape_numero',
                      ignoreDuplicates: false
                    });
                  
                  // Refresh results status query
                  queryClient.invalidateQueries({ queryKey: ['results-status'] });
                }
              } else {
                // When unchecking, update is_cancelled to false
                const etapeNumeroValue = currentClassement === 'Etape' ? currentStage : null;
                await supabase
                  .from('race_result_sets')
                  .update({ is_cancelled: false })
                  .eq('course_id', course.course_id)
                  .eq('type_classement', currentClassement)
                  .eq('etape_numero', etapeNumeroValue);
                
                queryClient.invalidateQueries({ queryKey: ['results-status'] });
              }
            }}
          />
          <label htmlFor="cancelled-checkbox-mobile" className="text-sm font-medium cursor-pointer">
            {courseIsStageRace && currentClassement === "Etape" ? "Étape annulée" : "Course annulée"}
          </label>
        </div>

        {/* Info message for cancelled stages */}
        {courseIsStageRace && currentClassement === "Etape" && isCancelled && (
          <div className="px-4 pb-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Cette étape annulée ne bloque pas la saisie des classements finaux
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3 pb-32">
          {/* Étape Section (Stage race only) */}
          {courseIsStageRace && (
            <Collapsible open={etapeOpen} onOpenChange={(open) => {
              setEtapeOpen(open);
              if (open) setCurrentClassement("Etape");
            }}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant={etapeOpen ? "default" : "outline"} 
                  className={cn(
                    "w-full justify-between transition-all",
                    etapeOpen && "shadow-md"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      etapeOpen && "rotate-90"
                    )} />
                    Étape {currentStage}
                  </span>
                  <Badge variant={etapeOpen ? "secondary" : "outline"}>
                    {currentClassement === "Etape" ? resultRows.filter(r => r.coureur_id && r.statut === 'finished').length : 0}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-1.5">
                {currentClassement === "Etape" && resultRows.filter(r => r.position > 0).map((row, index) => (
                  <div key={index} className={cn("flex items-center gap-1 p-1.5 bg-muted rounded-md", isCancelled && "opacity-50 pointer-events-none")}>
                    {row.coureur_id && (
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                    )}
                    <span className="font-bold text-[11px] w-4">{row.position}</span>
                    <div className="flex-1 min-w-0">
                      <CoureursCombobox
                        value={row.coureur_id}
                        onSelect={(coureur) => handleRiderChange(index, coureur)}
                        phaseId={course.phase_id}
                        disabled={isCancelled}
                        context="super-admin"
                      />
                    </div>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 whitespace-nowrap">{row.points}pts</Badge>
                  </div>
                ))}

                {/* Jersey Holders */}
                <div className="mt-3 pt-3 border-t border-dashed">
                  <h4 className="text-xs font-medium mb-2 text-muted-foreground">🏅 Porteurs de maillot</h4>
                  <JerseyHoldersInput
                    jerseyHolders={jerseyHolders}
                    onChange={(type, coureurId) => {
                      setJerseyHolders(prev => ({ ...prev, [type]: coureurId }));
                    }}
                    phaseId={course.phase_id}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* GC Section (for both One day and Stage race) */}
          <Collapsible open={gcOpen} onOpenChange={(open) => {
            setGcOpen(open);
            if (open) setCurrentClassement("General");
          }}>
            <CollapsibleTrigger asChild>
              <Button 
                variant={gcOpen ? "default" : "outline"} 
                className={cn(
                  "w-full justify-between transition-all",
                  gcOpen && "shadow-md"
                )}
              >
                <span className="flex items-center gap-2">
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform",
                    gcOpen && "rotate-90"
                  )} />
                  {courseIsStageRace ? "Classement Général" : "Résultats"}
                </span>
                <Badge variant={gcOpen ? "secondary" : "outline"}>
                  {currentClassement === "General" ? resultRows.filter(r => r.coureur_id).length : 0}
                </Badge>
              </Button>
            </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-1.5">
                {currentClassement === "General" && resultRows.filter(r => r.position > 0).map((row, index) => (
                  <div key={index} className={cn("flex items-center gap-1.5 p-2 bg-muted rounded-lg", isCancelled && "opacity-50 pointer-events-none")}>
                    {row.coureur_id && (
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                    )}
                    <span className="font-bold text-xs w-5">{row.position}</span>
                    <div className="flex-1">
                      <CoureursCombobox
                        value={row.coureur_id}
                        onSelect={(coureur) => handleRiderChange(index, coureur)}
                        phaseId={course.phase_id}
                        disabled={isCancelled}
                        context="super-admin"
                      />
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{row.points}pts</Badge>
                  </div>
                ))}
              </CollapsibleContent>
          </Collapsible>

          {/* Points Section (Stage race only) */}
          {courseIsStageRace && (
            <Collapsible open={pointsOpen} onOpenChange={(open) => {
              setPointsOpen(open);
              if (open) setCurrentClassement("Points");
            }}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant={pointsOpen ? "default" : "outline"} 
                  className={cn(
                    "w-full justify-between transition-all",
                    pointsOpen && "shadow-md"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      pointsOpen && "rotate-90"
                    )} />
                    Classement Points
                  </span>
                  <Badge variant={pointsOpen ? "secondary" : "outline"}>
                    {currentClassement === "Points" ? resultRows.filter(r => r.coureur_id).length : 0}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-1.5">
                {currentClassement === "Points" && resultRows.filter(r => r.position > 0).map((row, index) => (
                  <div key={index} className={cn("flex items-center gap-1.5 p-2 bg-muted rounded-lg", isCancelled && "opacity-50 pointer-events-none")}>
                    {row.coureur_id && (
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                    )}
                    <span className="font-bold text-xs w-5">{row.position}</span>
                    <div className="flex-1">
                      <CoureursCombobox
                        value={row.coureur_id}
                        onSelect={(coureur) => handleRiderChange(index, coureur)}
                        phaseId={course.phase_id}
                        disabled={isCancelled}
                        context="super-admin"
                      />
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{row.points}pts</Badge>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Montagne Section (Stage race only) */}
          {courseIsStageRace && (
            <Collapsible open={montagneOpen} onOpenChange={(open) => {
              setMontagneOpen(open);
              if (open) setCurrentClassement("Montagne");
            }}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant={montagneOpen ? "default" : "outline"} 
                  className={cn(
                    "w-full justify-between transition-all",
                    montagneOpen && "shadow-md"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      montagneOpen && "rotate-90"
                    )} />
                    Classement Montagne
                  </span>
                  <Badge variant={montagneOpen ? "secondary" : "outline"}>
                    {currentClassement === "Montagne" ? resultRows.filter(r => r.coureur_id).length : 0}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-1.5">
                {currentClassement === "Montagne" && resultRows.filter(r => r.position > 0).map((row, index) => (
                  <div key={index} className={cn("flex items-center gap-1.5 p-2 bg-muted rounded-lg", isCancelled && "opacity-50 pointer-events-none")}>
                    {row.coureur_id && (
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                    )}
                    <span className="font-bold text-xs w-5">{row.position}</span>
                    <div className="flex-1">
                      <CoureursCombobox
                        value={row.coureur_id}
                        onSelect={(coureur) => handleRiderChange(index, coureur)}
                        phaseId={course.phase_id}
                        disabled={isCancelled}
                        context="super-admin"
                      />
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{row.points}pts</Badge>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Jeune Section (Stage race only) */}
          {courseIsStageRace && (
            <Collapsible open={jeuneOpen} onOpenChange={(open) => {
              setJeuneOpen(open);
              if (open) setCurrentClassement("Jeune");
            }}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant={jeuneOpen ? "default" : "outline"} 
                  className={cn(
                    "w-full justify-between transition-all",
                    jeuneOpen && "shadow-md"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      jeuneOpen && "rotate-90"
                    )} />
                    Classement Jeune
                  </span>
                  <Badge variant={jeuneOpen ? "secondary" : "outline"}>
                    {currentClassement === "Jeune" ? resultRows.filter(r => r.coureur_id).length : 0}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-1.5">
                {currentClassement === "Jeune" && resultRows.filter(r => r.position > 0).map((row, index) => (
                  <div key={index} className={cn("flex items-center gap-1.5 p-2 bg-muted rounded-lg", isCancelled && "opacity-50 pointer-events-none")}>
                    {row.coureur_id && (
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                    )}
                    <span className="font-bold text-xs w-5">{row.position}</span>
                    <div className="flex-1">
                      <CoureursCombobox
                        value={row.coureur_id}
                        onSelect={(coureur) => handleRiderChange(index, coureur)}
                        phaseId={course.phase_id}
                        disabled={isCancelled}
                        context="super-admin"
                      />
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{row.points}pts</Badge>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Super Combatif Section (WT GT only) */}
          {courseIsStageRace && course.categorie === 'WT GT' && (
            <Collapsible open={combatifOpen} onOpenChange={(open) => {
              setCombatifOpen(open);
              if (open) setCurrentClassement("Combatif");
            }}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant={combatifOpen ? "default" : "outline"} 
                  className={cn(
                    "w-full justify-between transition-all",
                    combatifOpen && "shadow-md"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      combatifOpen && "rotate-90"
                    )} />
                    🏆 Super Combatif (150 pts)
                  </span>
                  <Badge variant={combatifOpen ? "secondary" : "outline"}>
                    {combatifWinner ? 1 : 0}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {currentClassement === "Combatif" && (
                  <div className="p-3 bg-muted rounded-lg">
                    <CoureursCombobox
                      value={combatifWinner}
                      onSelect={(coureur) => setCombatifWinner(coureur?.coureur_id || null)}
                      phaseId={course.phase_id}
                      disabled={isCancelled}
                      context="super-admin"
                    />
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ScrollArea>

      {/* Sticky bottom */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t p-3 safe-bottom shadow-lg z-[60]">
        {lastSaved && (
          <div className="text-[10px] text-center text-muted-foreground mb-2">
            Dernière sauvegarde: {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        
        <div className="flex gap-2">
          {/* Bouton Enregistrer */}
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending}
            variant="default"
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
          >
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? "..." : "Enregistrer"}
          </Button>
          
          {/* Bouton Étape suivante (courses par étapes uniquement) */}
          {courseIsStageRace && currentStage < course.nb_etapes && (
            <Button 
              onClick={() => {
                saveMutation.mutate();
                handleNextStage();
              }}
              disabled={saveMutation.isPending}
              variant="outline"
              className="flex-1"
            >
              <ChevronRight className="h-4 w-4 mr-1" />
              Étape suivante
            </Button>
          )}
        </div>
      </div>

      <ExportResultsImage
        course={course}
        currentStage={currentStage}
        currentClassement={currentClassement}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
    </div>
  );
};

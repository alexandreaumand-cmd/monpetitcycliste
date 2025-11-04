import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { X, AlertCircle } from "lucide-react";
import { normalizeCourseType, isStageRace } from "@/lib/courseType";

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

type ClassementType = "Etape" | "General" | "Points" | "Montagne" | "Jeune";
type StatutType = "finished" | "dnf" | "dns" | "dsq";

type ResultRow = {
  position: number;
  position_decimal?: number | null;
  coureur_id: string | null;
  coureur_nom: string | null;
  statut: StatutType;
  points: number;
  grid_version?: string;
};

type ScoringRule = {
  place: number;
  points: number;
};

export const ResultsEntryDrawer = ({
  open,
  onOpenChange,
  course,
  initialClassement,
  initialEtape,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course;
  initialClassement?: ClassementType;
  initialEtape?: number;
}) => {
  const [classementType, setClassementType] = useState<ClassementType>(initialClassement || "General");
  const [etapeNumero, setEtapeNumero] = useState<number>(initialEtape || 1);
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [gridPrepared, setGridPrepared] = useState(false);
  const [tttRidersPerTeam, setTttRidersPerTeam] = useState<number>(6); // Default 6 riders per team for TTT
  const requestIdRef = useRef(0);
  const [currentRequestId, setCurrentRequestId] = useState(0);
  const queryClient = useQueryClient();

  const courseIsStageRace = isStageRace(course.type_course);

  // Centralized state key - force re-render on any parameter change
  const sel_key = `${course.course_id}|${classementType}|${classementType === 'Etape' ? etapeNumero : 0}`;

  // Reset UI strictly on classification or stage change
  useEffect(() => {
    setResultRows([]);
    setGridPrepared(false);
  }, [sel_key]);

  // Fetch scoring rules - NO CACHE (staleTime: 0)
  const { data: scoringRules, isLoading: isLoadingRules, error: rulesError } = useQuery({
    queryKey: ['scoring-rules', sel_key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_rules_norm')
        .select('place, points')
        .eq('cat_canon', course.categorie)
        .eq('type_canon', classementType)
        .order('place');
      
      if (error) throw error;
      return (data || []) as ScoringRule[];
    },
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });


  const handlePrepareGrid = async () => {
    if (!scoringRules?.length) {
      toast.error("Aucun barème disponible pour cette catégorie");
      return;
    }

    // Increment request ID to prevent race conditions
    requestIdRef.current += 1;
    const thisRequestId = requestIdRef.current;
    setCurrentRequestId(thisRequestId);

    console.log('🔍 Loading existing results for:', {
      course_id: course.course_id,
      classementType,
      etapeNumero: classementType === 'Etape' ? etapeNumero : null
    });

    // Fetch existing results first
    let query = supabase
      .from('race_results')
      .select('*, coureurs(nom)')
      .eq('course_id', course.course_id)
      .eq('type_classement', classementType);
    
    if (classementType === 'Etape') {
      query = query.eq('etape_numero', etapeNumero);
    } else {
      query = query.is('etape_numero', null);
    }
    
    const { data: existingData, error: existingError } = await query.order('position', { ascending: true, nullsFirst: false });
    
    console.log('📊 Existing results loaded:', {
      count: existingData?.length || 0,
      data: existingData,
      error: existingError
    });
    
    if (existingError) {
      console.error('Error loading existing results:', existingError);
      toast.error(`Erreur chargement: ${existingError.message}`);
    }

    // Build grid with version tracking
    const buildGrid = () => {
      const maxPlace = Math.max(...scoringRules.map(sr => sr.place));
      const rows: ResultRow[] = [];

      // Finished riders (with positions)
      const finishedResults = existingData?.filter(r => r.statut === 'finished' && (r.position || r.position_decimal)) || [];
      
      for (let i = 1; i <= maxPlace; i++) {
        const existing = finishedResults.find(r => r.position === i || Math.floor(r.position_decimal || 0) === i);
        const basePoints = scoringRules.find(sr => sr.place === i)?.points || 0;
        
        // For TTT: divide points by number of riders per team (only if > 0)
        const points = (existing?.position_decimal && tttRidersPerTeam > 0)
          ? Math.floor(basePoints / tttRidersPerTeam) 
          : basePoints;
        
        rows.push({
          position: i,
          position_decimal: existing?.position_decimal || null,
          coureur_id: existing?.coureur_id || null,
          coureur_nom: existing ? (existing.coureurs as any)?.nom || null : null,
          statut: 'finished' as StatutType,
          points,
          grid_version: sel_key,
        });
      }

      // Non-finished riders (DNF/DNS/DSQ) - add at the end
      const nonFinishedResults = existingData?.filter(r => r.statut !== 'finished') || [];
      nonFinishedResults.forEach(r => {
        rows.push({
          position: 0, // No position for non-finished
          coureur_id: r.coureur_id,
          coureur_nom: (r.coureurs as any)?.nom || null,
          statut: r.statut as StatutType,
          points: 0,
          grid_version: sel_key,
        });
      });

      return rows;
    };

    // Only apply if this is still the latest request
    const rows = buildGrid();
    if (thisRequestId === requestIdRef.current) {
      setResultRows(rows);
      setGridPrepared(true);
    }
  };

  // Load ttt_riders_per_team from courses table when opening drawer
  useEffect(() => {
    if (open) {
      const loadTttConfig = async () => {
        const { data } = await supabase
          .from('courses')
          .select('ttt_riders_per_team')
          .eq('id', course.course_id)
          .single();
        
        if (data?.ttt_riders_per_team) {
          setTttRidersPerTeam(data.ttt_riders_per_team);
        }
      };
      loadTttConfig();
    }
  }, [open, course.course_id]);

  // Auto-load grid when drawer opens and scoring rules are ready
  useEffect(() => {
    if (open && !isLoadingRules && scoringRules && scoringRules.length > 0 && !gridPrepared) {
      console.log('🎯 Auto-loading grid with scoring rules ready');
      handlePrepareGrid();
    }
  }, [open, isLoadingRules, scoringRules, gridPrepared]);

  const handleRiderChange = (index: number, riderId: string | null, riderName: string | null) => {
    setResultRows(prev => prev.map((row, i) => 
      i === index 
        ? { ...row, coureur_id: riderId, coureur_nom: riderName }
        : row
    ));
  };

  const handleStatutChange = (index: number, statut: StatutType) => {
    setResultRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const basePoints = scoringRules?.find(sr => sr.place === row.position)?.points || 0;
      // For TTT: divide points by number of riders per team (only if > 0)
      const points = statut === 'finished' 
        ? ((row.position_decimal && tttRidersPerTeam > 0) ? Math.floor(basePoints / tttRidersPerTeam) : basePoints)
        : 0;
      return { ...row, statut, points };
    }));
  };

  const handleRemoveRow = (index: number) => {
    setResultRows(prev => prev.filter((_, i) => i !== index));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validRows = resultRows.filter(r => r.coureur_id && r.grid_version === sel_key);
      
      if (validRows.length === 0) {
        throw new Error("Aucun résultat à sauvegarder");
      }

      // Save ttt_riders_per_team to courses table if it's a TTT stage
      if (tttRidersPerTeam > 0) {
        await supabase
          .from('courses')
          .update({ ttt_riders_per_team: tttRidersPerTeam })
          .eq('id', course.course_id);
      }

      // Check for duplicates among finished riders
      const finishedRiders = validRows.filter(r => r.statut === 'finished');
      const coureurIds = finishedRiders.map(r => r.coureur_id);
      const duplicates = coureurIds.filter((id, idx) => coureurIds.indexOf(id) !== idx);
      if (duplicates.length > 0) {
        throw new Error("Doublons détectés dans la saisie");
      }

      // SERVER-SIDE: Reload scoring grid to recalculate points (source of truth)
      const { data: serverScoringRules, error: rulesError } = await supabase
        .from('scoring_rules_norm')
        .select('place, points')
        .eq('cat_canon', course.categorie)
        .eq('type_canon', classementType)
        .order('place');

      if (rulesError) throw rulesError;
      if (!serverScoringRules?.length) {
        console.warn(`⚠️ Aucun barème trouvé pour ${course.categorie} / ${classementType}`);
        // Continue with empty scoring map
      }

      const scoringMap = new Map(serverScoringRules.map(sr => [sr.place, sr.points]));

      // Calculate date_classement
      // Get saison_id from phase
      const { data: phaseData } = await supabase
        .from('phases')
        .select('saison_id')
        .eq('id', course.phase_id)
        .single();

      if (!phaseData?.saison_id) {
        throw new Error('Impossible de trouver la saison pour cette course');
      }

      const dateClassement = classementType === 'Etape'
        ? new Date(new Date(course.date_debut).getTime() + (etapeNumero - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : course.date_fin;

      // Fetch manager_id for each rider first
      const riderManagerMap = new Map<string, string | null>();
      for (const row of validRows) {
        const { data: roster } = await supabase
          .from('rosters')
          .select('manager_id')
          .eq('phase_id', course.phase_id)
          .eq('coureur_id', row.coureur_id!)
          .maybeSingle();
        
        riderManagerMap.set(row.coureur_id!, roster?.manager_id || null);
      }

      // Upsert race_results with manager_id and points
      const resultsToUpsert = validRows.map(row => {
        const isFinished = row.statut === 'finished';
        const positionValue = isFinished && row.position > 0 ? row.position : null;
        const positionDecimalValue = row.position_decimal || null;
        const basePoints = scoringMap.get(row.position) || 0;
        // For TTT: divide points by number of riders per team (only if > 0)
        const points = isFinished && row.position > 0 
          ? ((positionDecimalValue && tttRidersPerTeam > 0) ? Math.floor(basePoints / tttRidersPerTeam) : basePoints)
          : 0;
        
        return {
          course_id: course.course_id,
          coureur_id: row.coureur_id!,
          type_classement: classementType,
          etape_numero: classementType === 'Etape' ? etapeNumero : null,
          position: positionValue,
          position_decimal: positionDecimalValue,
          statut: row.statut,
          date_classement: dateClassement,
          manager_id: riderManagerMap.get(row.coureur_id!),
          points,
          saison_id: phaseData.saison_id,
        };
      });

      const { error: resultsError } = await supabase
        .from('race_results')
        .upsert(resultsToUpsert, {
          onConflict: 'course_id,coureur_id,type_classement,etape_numero',
        });

      if (resultsError) throw resultsError;

      // Delete old points for this classification
      let deleteQuery = supabase
        .from('points_ledger')
        .delete()
        .eq('course_id', course.course_id)
        .eq('type_classement', classementType);

      if (classementType === 'Etape') {
        deleteQuery = deleteQuery.eq('etape_numero', etapeNumero);
      } else {
        deleteQuery = deleteQuery.is('etape_numero', null);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;

      // Insert new points (recalculated server-side)
      const pointsToInsert = [];
      for (const row of validRows) {
        if (row.statut !== 'finished' || row.position === 0) continue;

        // SERVER RECALCULATION of points
        const basePoints = scoringMap.get(row.position) || 0;
        // For TTT: divide points by number of riders per team (only if > 0)
        const serverPoints = (row.position_decimal && tttRidersPerTeam > 0)
          ? Math.floor(basePoints / tttRidersPerTeam)
          : basePoints;
        if (serverPoints === 0) continue;

        const managerId = riderManagerMap.get(row.coureur_id!);
        if (managerId) {
          pointsToInsert.push({
            course_id: course.course_id,
            coureur_id: row.coureur_id!,
            manager_id: managerId,
            phase_id: course.phase_id,
            type_classement: classementType,
            etape_numero: classementType === 'Etape' ? etapeNumero : null,
            points: serverPoints, // SERVER-SIDE recalculated with TTT division
          });
        }
      }

      if (pointsToInsert.length > 0) {
        const { error: pointsError } = await supabase
          .from('points_ledger')
          .insert(pointsToInsert);

        if (pointsError) throw pointsError;
      }

      return {
        inserted: validRows.length,
        pointsWritten: pointsToInsert.length,
        skipped: validRows.length - pointsToInsert.length,
      };
    },
    onSuccess: (result) => {
      toast.success(
        `${result.inserted} résultats enregistrés, ${result.pointsWritten} points écrits` +
        (result.skipped > 0 ? `, ${result.skipped} coureurs sans manager` : '')
      );
      queryClient.invalidateQueries({ queryKey: ['results-status'] });
      handlePrepareGrid(); // Reload grid with fresh data
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleClassementChange = (value: ClassementType) => {
    setClassementType(value);
    // Reset etape if switching away from Etape
    if (value !== 'Etape') {
      setEtapeNumero(1);
    }
    setGridPrepared(false);
    setResultRows([]);
  };

  const handleEtapeChange = (value: string) => {
    setEtapeNumero(parseInt(value));
    setGridPrepared(false);
    setResultRows([]);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>
            {course.course_nom} — {classementType}
            {classementType === 'Etape' && ` (Étape ${etapeNumero})`}
          </DrawerTitle>
          <DrawerDescription>
            Saisie rapide des résultats • Clé: {sel_key}
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4">
          {!gridPrepared ? (
            <div className="space-y-6 py-4">
              {/* Step 1: Choose classification */}
              <div className="space-y-4">
                <h3 className="font-semibold">1. Choisir le classement</h3>
                
                <Tabs value={classementType} onValueChange={(v) => handleClassementChange(v as ClassementType)}>
                  <TabsList className="grid w-full grid-cols-5">
                    {courseIsStageRace ? (
                      <>
                        <TabsTrigger value="Etape">Étape</TabsTrigger>
                        <TabsTrigger value="General">GC</TabsTrigger>
                        <TabsTrigger value="Points">Points</TabsTrigger>
                        <TabsTrigger value="Montagne">Montagne</TabsTrigger>
                        <TabsTrigger value="Jeune">Jeune</TabsTrigger>
                      </>
                    ) : (
                      <TabsTrigger value="General" className="col-span-5">Général</TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>

                {classementType === 'Etape' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Numéro d'étape</label>
                      <Select value={etapeNumero.toString()} onValueChange={handleEtapeChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: course.nb_etapes }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              Étape {i + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nombre de coureurs TTT (0 si course classique)</label>
                      <Select value={tttRidersPerTeam.toString()} onValueChange={(v) => setTttRidersPerTeam(parseInt(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Course classique (0)</SelectItem>
                          <SelectItem value="3">3 coureurs/équipe</SelectItem>
                          <SelectItem value="4">4 coureurs/équipe</SelectItem>
                          <SelectItem value="5">5 coureurs/équipe</SelectItem>
                          <SelectItem value="6">6 coureurs/équipe</SelectItem>
                          <SelectItem value="7">7 coureurs/équipe</SelectItem>
                          <SelectItem value="8">8 coureurs/équipe</SelectItem>
                        </SelectContent>
                      </Select>
                      {tttRidersPerTeam > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Points par sous-place = Points de la place ÷ {tttRidersPerTeam}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <Button 
                  onClick={handlePrepareGrid} 
                  className="w-full"
                  disabled={isLoadingRules || !scoringRules?.length}
                >
                  {isLoadingRules ? 'Chargement du barème...' : 'Préparer la saisie'}
                </Button>
              </div>

              {/* Barème preview or error */}
              {isLoadingRules && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              )}

              {rulesError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Erreur de chargement du barème: {rulesError.message}
                  </AlertDescription>
                </Alert>
              )}

              {!isLoadingRules && !rulesError && scoringRules?.length === 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Aucun barème disponible pour {classementType} / {course.categorie} ({course.type_course}).
                    Vérifiez la configuration des barèmes.
                  </AlertDescription>
                </Alert>
              )}

              {scoringRules && scoringRules.length > 0 && (
                <div className="rounded-md border p-4 space-y-2" key={sel_key}>
                  <h4 className="font-medium text-sm">
                    Barème actuel • {course.categorie} / {classementType}
                  </h4>
                  <div className="grid grid-cols-5 gap-2 text-sm">
                    {scoringRules.slice(0, 10).map((rule) => (
                      <div key={rule.place} className="flex justify-between">
                        <span className="text-muted-foreground">{rule.place}e</span>
                        <Badge variant="secondary">{rule.points}pts</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
              <div className="space-y-4">
              {/* Step 2: Entry table */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">2. Saisie des résultats</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrepareGrid}>
                    Recharger depuis BDD
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setGridPrepared(false)}>
                    Changer de classement
                  </Button>
                </div>
              </div>

              <div className="rounded-md border" key={sel_key}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Position</TableHead>
                      <TableHead>Coureur</TableHead>
                      <TableHead className="w-[150px]">Statut</TableHead>
                      <TableHead className="w-[100px] text-right">Points</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultRows
                      .filter(row => row.grid_version === sel_key)
                      .map((row, index) => (
                        <TableRow key={`${sel_key}-${row.position}-${index}`}>
                          <TableCell className="font-medium">{row.position || '—'}</TableCell>
                          <TableCell>
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
                              showTakenRiders={true}
                            />
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={row.statut} 
                              onValueChange={(v) => handleStatutChange(index, v as StatutType)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="finished">Finished</SelectItem>
                                <SelectItem value="dnf">DNF</SelectItem>
                                <SelectItem value="dns">DNS</SelectItem>
                                <SelectItem value="dsq">DSQ</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {row.points}
                          </TableCell>
                          <TableCell>
                            {row.coureur_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveRow(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DrawerFooter>
          {gridPrepared && (
            <Button 
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer les résultats'}
            </Button>
          )}
          <DrawerClose asChild>
            <Button variant="outline">Fermer</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

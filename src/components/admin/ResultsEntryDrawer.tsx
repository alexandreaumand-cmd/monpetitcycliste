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
import { RiderAutocomplete } from "./RiderAutocomplete";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { X, AlertCircle } from "lucide-react";

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course;
}) => {
  const [classementType, setClassementType] = useState<ClassementType>("General");
  const [etapeNumero, setEtapeNumero] = useState<number>(1);
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [gridPrepared, setGridPrepared] = useState(false);
  const requestIdRef = useRef(0);
  const [currentRequestId, setCurrentRequestId] = useState(0);
  const queryClient = useQueryClient();

  const isStageRace = course.type_course === 'stage races';

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
        .from('scoring_rules')
        .select('*')
        .eq('categorie', course.categorie)
        .eq('type_classement', classementType)
        .eq('type', course.type_course)
        .order('place');
      
      if (error) throw error;
      return (data || []) as ScoringRule[];
    },
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  // Fetch existing results
  const { data: existingResults } = useQuery({
    queryKey: ['existing-results', sel_key],
    queryFn: async () => {
      let query = supabase
        .from('race_results')
        .select('*, coureurs(nom)')
        .eq('course_id', course.course_id)
        .eq('type_classement', classementType);
      
      if (classementType === 'Etape') {
        query = query.eq('etape_numero', etapeNumero);
      }
      
      const { data, error } = await query.order('position', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: open && gridPrepared,
    staleTime: 0,
  });

  const handlePrepareGrid = () => {
    if (!scoringRules?.length) {
      toast.error("Aucun barème disponible pour cette catégorie");
      return;
    }

    // Increment request ID to prevent race conditions
    requestIdRef.current += 1;
    const thisRequestId = requestIdRef.current;
    setCurrentRequestId(thisRequestId);

    // Build grid with version tracking
    const buildGrid = () => {
      if (existingResults?.length) {
        const rows: ResultRow[] = existingResults.map(r => ({
          position: r.position || 0,
          coureur_id: r.coureur_id,
          coureur_nom: (r.coureurs as any)?.nom || null,
          statut: r.statut as StatutType,
          points: scoringRules.find(sr => sr.place === r.position)?.points || 0,
          grid_version: sel_key,
        }));
        return rows;
      } else {
        const maxPlace = Math.max(...scoringRules.map(sr => sr.place));
        const rows: ResultRow[] = Array.from({ length: maxPlace }, (_, i) => ({
          position: i + 1,
          coureur_id: null,
          coureur_nom: null,
          statut: 'finished' as StatutType,
          points: scoringRules.find(sr => sr.place === i + 1)?.points || 0,
          grid_version: sel_key,
        }));
        return rows;
      }
    };

    // Only apply if this is still the latest request
    const rows = buildGrid();
    if (thisRequestId === requestIdRef.current) {
      setResultRows(rows);
      setGridPrepared(true);
    }
  };

  const handleRiderChange = (position: number, riderId: string | null, riderName: string | null) => {
    setResultRows(prev => prev.map(row => 
      row.position === position 
        ? { ...row, coureur_id: riderId, coureur_nom: riderName }
        : row
    ));
  };

  const handleStatutChange = (position: number, statut: StatutType) => {
    setResultRows(prev => prev.map(row => 
      row.position === position 
        ? { 
            ...row, 
            statut,
            points: statut === 'finished' ? (scoringRules?.find(sr => sr.place === position)?.points || 0) : 0
          }
        : row
    ));
  };

  const handleRemoveRow = (position: number) => {
    setResultRows(prev => prev.map(row => 
      row.position === position 
        ? { ...row, coureur_id: null, coureur_nom: null, statut: 'finished' as StatutType }
        : row
    ));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validRows = resultRows.filter(r => r.coureur_id && r.grid_version === sel_key);
      
      if (validRows.length === 0) {
        throw new Error("Aucun résultat à sauvegarder");
      }

      // SERVER-SIDE: Reload scoring grid to recalculate points (source of truth)
      const { data: serverScoringRules, error: rulesError } = await supabase
        .from('scoring_rules')
        .select('*')
        .eq('categorie', course.categorie)
        .eq('type_classement', classementType)
        .eq('type', course.type_course)
        .order('place');

      if (rulesError) throw rulesError;
      if (!serverScoringRules?.length) {
        throw new Error("Barème introuvable sur le serveur");
      }

      const scoringMap = new Map(serverScoringRules.map(sr => [sr.place, sr.points]));

      // Calculate date_classement
      const dateClassement = classementType === 'Etape'
        ? new Date(new Date(course.date_debut).getTime() + (etapeNumero - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : course.date_fin;

      // Upsert race_results
      const resultsToUpsert = validRows.map(row => ({
        course_id: course.course_id,
        coureur_id: row.coureur_id!,
        type_classement: classementType,
        etape_numero: classementType === 'Etape' ? etapeNumero : null,
        position: row.statut === 'finished' ? row.position : null,
        statut: row.statut,
        date_classement: dateClassement,
      }));

      const { error: resultsError } = await supabase
        .from('race_results')
        .upsert(resultsToUpsert, {
          onConflict: 'course_id,coureur_id,type_classement,etape_numero',
        });

      if (resultsError) throw resultsError;

      // Delete old points for this classification
      const { error: deleteError } = await supabase
        .from('points_ledger')
        .delete()
        .eq('course_id', course.course_id)
        .eq('type_classement', classementType)
        .eq('etape_numero', classementType === 'Etape' ? etapeNumero : null);

      if (deleteError) throw deleteError;

      // Insert new points (recalculated server-side)
      const pointsToInsert = [];
      for (const row of validRows) {
        if (row.statut !== 'finished') continue;

        // SERVER RECALCULATION of points
        const serverPoints = scoringMap.get(row.position) || 0;
        if (serverPoints === 0) continue;

        // Find manager via rosters
        const { data: roster } = await supabase
          .from('rosters')
          .select('manager_id')
          .eq('phase_id', course.phase_id)
          .eq('coureur_id', row.coureur_id!)
          .maybeSingle();

        if (roster) {
          pointsToInsert.push({
            course_id: course.course_id,
            coureur_id: row.coureur_id!,
            manager_id: roster.manager_id,
            phase_id: course.phase_id,
            type_classement: classementType,
            etape_numero: classementType === 'Etape' ? etapeNumero : null,
            points: serverPoints, // SERVER-SIDE recalculated
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
      queryClient.invalidateQueries({ queryKey: ['existing-results'] });
      setGridPrepared(false);
      setResultRows([]);
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
                    {isStageRace ? (
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
                <Button variant="outline" size="sm" onClick={() => setGridPrepared(false)}>
                  Changer de classement
                </Button>
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
                      .map((row) => (
                        <TableRow key={`${sel_key}-${row.position}`}>
                          <TableCell className="font-medium">{row.position}</TableCell>
                          <TableCell>
                            <RiderAutocomplete
                              phaseId={course.phase_id}
                              value={row.coureur_id}
                              riderName={row.coureur_nom}
                              onChange={(id, name) => handleRiderChange(row.position, id, name)}
                            />
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={row.statut} 
                              onValueChange={(v) => handleStatutChange(row.position, v as StatutType)}
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
                                onClick={() => handleRemoveRow(row.position)}
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

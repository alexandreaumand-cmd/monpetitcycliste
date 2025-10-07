import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";
import { X, ChevronLeft, ChevronRight, Save, Check } from "lucide-react";
import { normalizeCourseType, isStageRace } from "@/lib/courseType";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { JerseyHoldersInput } from "./JerseyHoldersInput";

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
  const [currentClassement, setCurrentClassement] = useState<ClassementType>("Etape");
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [jerseyHolders, setJerseyHolders] = useState<Record<string, string>>({});
  const [etapeOpen, setEtapeOpen] = useState(true);
  const [gcOpen, setGcOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [montagneOpen, setMontagneOpen] = useState(false);
  const [jeuneOpen, setJeuneOpen] = useState(false);
  const queryClient = useQueryClient();

  const courseIsStageRace = isStageRace(course.type_course);

  // Fetch scoring rules
  const { data: scoringRules } = useQuery({
    queryKey: ['scoring-rules', course.course_id, currentClassement],
    queryFn: async () => {
      const normalized = normalizeCourseType(course.type_course);
      
      const { data, error } = await supabase
        .from('scoring_rules')
        .select('*')
        .eq('categorie', course.categorie)
        .eq('type_classement', currentClassement)
        .eq('type', normalized.canonicalForRules)
        .order('place');
      
      if (error) throw error;
      return (data || []) as ScoringRule[];
    },
  });

  // Load existing results
  useEffect(() => {
    loadResults();
  }, [currentClassement, currentStage]);

  const loadResults = async () => {
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
    
    if (scoringRules && scoringRules.length > 0) {
      const maxPlace = Math.max(...scoringRules.map(sr => sr.place));
      const rows: ResultRow[] = [];

      const finishedResults = existingData?.filter(r => r.statut === 'finished' && r.position) || [];
      
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

      setResultRows(rows);
    }

    // Load jersey holders if stage race
    if (courseIsStageRace && currentClassement === 'Etape') {
      const jerseyMappings: Array<{ key: string; type: ClassementType }> = [
        { key: "general", type: "General" },
        { key: "vert", type: "Points" },
        { key: "montagne", type: "Montagne" },
        { key: "jeune", type: "Jeune" },
      ];

      const newJerseyHolders: Record<string, string> = {};

      for (const { key, type } of jerseyMappings) {
        const { data: jerseyData } = await supabase
          .from('race_results')
          .select('coureur_id')
          .eq('course_id', course.course_id)
          .eq('type_classement', type)
          .eq('etape_numero', currentStage)
          .eq('position', 1)
          .maybeSingle();

        if (jerseyData?.coureur_id) {
          newJerseyHolders[key] = jerseyData.coureur_id;
        }
      }

      setJerseyHolders(newJerseyHolders);
    }
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
      const validRows = resultRows.filter(r => r.coureur_id);
      
      if (validRows.length === 0) {
        throw new Error("Aucun résultat à sauvegarder");
      }

      const normalized = normalizeCourseType(course.type_course);
      const { data: serverScoringRules, error: rulesError } = await supabase
        .from('scoring_rules')
        .select('*')
        .eq('categorie', course.categorie)
        .eq('type_classement', currentClassement)
        .eq('type', normalized.canonicalForRules)
        .order('place');

      if (rulesError) throw rulesError;
      if (!serverScoringRules?.length) {
        throw new Error("Barème introuvable");
      }

      const scoringMap = new Map(serverScoringRules.map(sr => [sr.place, sr.points]));

      const dateClassement = currentClassement === 'Etape'
        ? new Date(new Date(course.date_debut).getTime() + (currentStage - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : course.date_fin;

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
        };
      });

      const { error: resultsError } = await supabase
        .from('race_results')
        .upsert(resultsToUpsert, {
          onConflict: 'course_id,coureur_id,type_classement,etape_numero',
        });

      if (resultsError) throw resultsError;

      // Save jersey holders
      if (courseIsStageRace && currentClassement === 'Etape') {
        const jerseyMappings: Array<{ key: string; type: ClassementType }> = [
          { key: "general", type: "General" },
          { key: "vert", type: "Points" },
          { key: "montagne", type: "Montagne" },
          { key: "jeune", type: "Jeune" },
        ];

        for (const { key, type } of jerseyMappings) {
          const coureurId = jerseyHolders[key];
          if (!coureurId) continue;

          const managerId = riderManagerMap.get(coureurId);
          await supabase.from('race_results').upsert({
            course_id: course.course_id,
            coureur_id: coureurId,
            type_classement: type as ClassementType,
            etape_numero: currentStage,
            position: 1,
            statut: 'finished',
            date_classement: dateClassement,
            manager_id: managerId,
            points: 0,
          }, {
            onConflict: 'course_id,coureur_id,type_classement,etape_numero',
          });
        }
      }

      // Delete and reinsert points
      let deleteQuery = supabase
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
        await supabase.from('points_ledger').insert(pointsToInsert);
      }
    },
    onSuccess: () => {
      toast.success("Résultats enregistrés");
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

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <div className="flex-1 text-center">
            <h2 className="font-bold text-sm truncate">{course.course_nom}</h2>
            {courseIsStageRace && (
              <p className="text-xs text-muted-foreground">Étape {currentStage}/{course.nb_etapes}</p>
            )}
          </div>
          <Button 
            size="icon" 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-5 w-5" />
          </Button>
        </div>

        {/* Stage navigator */}
        {courseIsStageRace && (
          <div className="flex items-center justify-between px-4 pb-3 gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handlePrevStage}
              disabled={currentStage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex-1 flex gap-1 justify-center overflow-x-auto">
              {Array.from({ length: course.nb_etapes }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setCurrentStage(num)}
                  className={`min-w-[32px] h-8 rounded-full text-xs font-medium transition-colors ${
                    num === currentStage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <Button 
              variant="outline" 
              size="icon"
              onClick={handleNextStage}
              disabled={currentStage === course.nb_etapes}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="p-4 space-y-3">
          {/* Étape Section */}
          {courseIsStageRace && (
            <Collapsible open={etapeOpen} onOpenChange={setEtapeOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>Étape {currentStage}</span>
                  <Badge variant={etapeOpen ? "default" : "secondary"}>
                    {resultRows.filter(r => r.coureur_id && r.statut === 'finished').length}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {resultRows.filter(r => r.position > 0).map((row, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="font-bold text-sm w-6">{row.position}</span>
                    <div className="flex-1">
                      <CoureursCombobox
                        value={row.coureur_id}
                        onSelect={(coureur) => handleRiderChange(index, coureur)}
                        phaseId={course.phase_id}
                      />
                    </div>
                    <Badge variant="secondary" className="text-xs">{row.points}pts</Badge>
                  </div>
                ))}

                {/* Jersey Holders */}
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Porteurs de maillot</h4>
                  <JerseyHoldersInput
                    jerseyHolders={{
                      general: jerseyHolders.general || null,
                      vert: jerseyHolders.vert || null,
                      montagne: jerseyHolders.montagne || null,
                      jeune: jerseyHolders.jeune || null,
                      combattif: null,
                    }}
                    onChange={(type, coureurId) => {
                      setJerseyHolders(prev => ({ ...prev, [type]: coureurId || '' }));
                    }}
                    phaseId={course.phase_id}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* GC Section */}
          {courseIsStageRace && (
            <Collapsible open={gcOpen} onOpenChange={(open) => {
              setGcOpen(open);
              if (open) setCurrentClassement("General");
            }}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>Classement Général</span>
                  <Badge variant={gcOpen ? "default" : "secondary"}>
                    {currentClassement === "General" ? resultRows.filter(r => r.coureur_id).length : 0}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {currentClassement === "General" && resultRows.filter(r => r.position > 0).map((row, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="font-bold text-sm w-6">{row.position}</span>
                    <div className="flex-1">
                      <CoureursCombobox
                        value={row.coureur_id}
                        onSelect={(coureur) => handleRiderChange(index, coureur)}
                        phaseId={course.phase_id}
                      />
                    </div>
                    <Badge variant="secondary" className="text-xs">{row.points}pts</Badge>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* One day race - just General */}
          {!courseIsStageRace && resultRows.filter(r => r.position > 0).map((row, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="font-bold text-sm w-6">{row.position}</span>
              <div className="flex-1">
                <CoureursCombobox
                  value={row.coureur_id}
                  onSelect={(coureur) => handleRiderChange(index, coureur)}
                  phaseId={course.phase_id}
                />
              </div>
              <Badge variant="secondary" className="text-xs">{row.points}pts</Badge>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Sticky bottom */}
      <div className="sticky bottom-0 bg-background border-t p-4">
        <div className="flex gap-2">
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending}
            className="flex-1"
          >
            {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
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
              <span>Sauver & Suivant</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

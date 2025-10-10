import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { ResultsEntryStudio } from "./ResultsEntryStudio";
import { Calendar, Trophy, AlertCircle, CheckCircle2, Award } from "lucide-react";
import { BonusEntryDialog } from "./bonus/BonusEntryDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { normalizeCourseType, isStageRace } from "@/lib/courseType";
import { useSeasonContext } from "@/contexts/SeasonContext";

type Course = {
  course_id: string;
  course_nom: string;
  categorie: string;
  type_course: "One day" | "Stage race";
  date_debut: string;
  date_fin: string;
  nb_etapes: number;
  phase_id: string;
  phase_nom: string;
};

type ResultsStatus = {
  nb_lignes_etapes: number;
  nb_lignes_gc: number;
  nb_lignes_points: number;
  nb_lignes_montagne: number;
  nb_lignes_jeune: number;
};

export const RecentResults = () => {
  const { selectedSeason, seasons, phases: allPhases } = useSeasonContext();
  
  type ViewMode = '30days' | 'phase';
  const [viewMode, setViewMode] = useState<ViewMode>('30days');
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [studioMode, setStudioMode] = useState<'create' | 'edit'>('create');
  const [studioOpen, setStudioOpen] = useState(false);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);

  // Filter phases by selected season
  const phases = allPhases?.filter(p => p.saison_id === selectedSeason?.id);

  // Fetch recent courses
  const { data: recentCourses, isLoading } = useQuery({
    queryKey: ['recent-courses', viewMode, selectedPhase, selectedSeason?.id],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select('*, phases!inner(saison_id)')
        .eq('phases.saison_id', selectedSeason?.id)
        .order('date_debut', { ascending: false });
      
      if (viewMode === '30days') {
        // Filtrer sur les 30 derniers jours
        query = query
          .gte('date_fin', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .lte('date_debut', new Date().toISOString().split('T')[0]);
      } else if (viewMode === 'phase' && selectedPhase) {
        // Filtrer sur la phase sélectionnée
        query = query.eq('phase_id', selectedPhase);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []).map(c => {
        const normalized = normalizeCourseType(c.type_course);
        return {
          course_id: c.id,
          course_nom: c.nom,
          categorie: c.categorie,
          type_course: normalized.display,
          date_debut: c.date_debut || '',
          date_fin: c.date_fin || '',
          nb_etapes: normalized.isStage
            ? (c.categorie === 'WT GT'
                ? 21
                : Math.max(1, Math.ceil((new Date(c.date_fin || c.date_debut).getTime() - new Date(c.date_debut).getTime()) / (1000 * 60 * 60 * 24)) + 1))
            : 1,
          phase_id: c.phase_id || '',
          phase_nom: ''
        };
      }) as Course[];
    },
  });

  // Fetch results status for each course with expected counts
  const { data: resultsStatusMap } = useQuery({
    queryKey: ['results-status', recentCourses?.map(c => c.course_id)],
    queryFn: async () => {
      if (!recentCourses?.length) return {};
      
      const statusMap: Record<string, ResultsStatus & {
        expected_gc?: number;
        expected_points?: number;
        expected_montagne?: number;
        expected_jeune?: number;
      }> = {};
      
      for (const course of recentCourses) {
        const { data, error } = await supabase
          .from('race_results')
          .select('type_classement, coureur_id, etape_numero')
          .eq('course_id', course.course_id)
          .gte('date_classement', course.date_debut)
          .lte('date_classement', course.date_fin);
        
        if (error) {
          console.error('Error fetching status:', error);
          continue;
        }
        
        // Get expected positions from scoring rules for the selected season
        const { data: scoringData } = await supabase
          .from('scoring_rules_saisons')
          .select('type_classement, place')
          .eq('saison_id', selectedSeason?.id)
          .ilike('categorie', course.categorie)
          .order('place', { ascending: false });
        
        const getMaxPlace = (typeClassement: string) => {
          const filtered = scoringData?.filter(s => s.type_classement === typeClassement);
          return filtered?.[0]?.place || 0;
        };
        
        statusMap[course.course_id] = {
          nb_lignes_etapes: new Set(data?.filter(r => r.type_classement === 'Etape').map(r => r.etape_numero)).size || 0,
          nb_lignes_gc: data?.filter(r => r.type_classement === 'General' && r.coureur_id).length || 0,
          nb_lignes_points: data?.filter(r => r.type_classement === 'Points' && r.coureur_id).length || 0,
          nb_lignes_montagne: data?.filter(r => r.type_classement === 'Montagne' && r.coureur_id).length || 0,
          nb_lignes_jeune: data?.filter(r => r.type_classement === 'Jeune' && r.coureur_id).length || 0,
          expected_gc: getMaxPlace('General'),
          expected_points: getMaxPlace('Points'),
          expected_montagne: getMaxPlace('Montagne'),
          expected_jeune: getMaxPlace('Jeune'),
        };
      }
      
      return statusMap;
    },
    enabled: !!recentCourses?.length && !!selectedSeason?.id,
  });

  const filteredCourses = recentCourses?.filter(course => {
    if (typeFilter !== "all" && course.type_course !== typeFilter) return false;
    if (searchFilter && !course.course_nom.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  const handleOpenStudio = (course: Course, mode: 'create' | 'edit') => {
    setSelectedCourse(course);
    setStudioMode(mode);
    setStudioOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Résultats récents</h2>
          <p className="text-muted-foreground">
            Saisie des résultats • Saison {selectedSeason?.annee}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap mb-6">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={viewMode === '30days' ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode('30days')}
          >
            30 derniers jours
          </Button>
          
          {phases?.map((phase) => {
            const isSelected = viewMode === 'phase' && selectedPhase === phase.id;
            return (
              <Button
                key={phase.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setViewMode('phase');
                  setSelectedPhase(phase.id);
                }}
              >
                Phase {phase.index_dans_saison}
              </Button>
            );
          })}
          
          {viewMode === 'phase' && selectedPhase && (
            <Button
              onClick={() => setBonusDialogOpen(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Award className="h-4 w-4" />
              Bonus
            </Button>
          )}
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Type de course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="One day">Course d'un jour</SelectItem>
            <SelectItem value="Stage race">Course à étapes</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Rechercher une course..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Courses List */}
      {isLoading ? (
        <div className="text-center py-8">Chargement des courses...</div>
      ) : filteredCourses?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune course trouvée pour cette période
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCourses?.map((course) => {
            const status = resultsStatusMap?.[course.course_id];
            const courseIsStageRace = isStageRace(course.type_course);
            
            return (
              <Card key={course.course_id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5" />
                        {course.course_nom}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{course.categorie}</Badge>
                        <Badge variant="outline">{courseIsStageRace ? 'Course à étapes' : 'Course d\'un jour'}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!status?.nb_lignes_gc && !status?.nb_lignes_etapes ? (
                        <Button onClick={() => handleOpenStudio(course, 'create')}>
                          Saisir
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => handleOpenStudio(course, 'edit')}>
                          Corriger
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(course.date_debut).toLocaleDateString('fr-FR')} 
                    {course.date_fin !== course.date_debut && 
                      ` → ${new Date(course.date_fin).toLocaleDateString('fr-FR')}`}
                  </div>

                  {/* Status */}
                  <div className="space-y-3">
                    {courseIsStageRace ? (
                      <>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>Étapes saisies</span>
                            <span className="font-medium">{status?.nb_lignes_etapes || 0} / {course.nb_etapes}</span>
                          </div>
                          <Progress 
                            value={((status?.nb_lignes_etapes || 0) / course.nb_etapes) * 100} 
                            className="h-2"
                          />
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                          {/* GC Badge */}
                          {(() => {
                            const filled = status?.nb_lignes_gc || 0;
                            const expected = status?.expected_gc || 0;
                            const isPartial = filled > 0 && filled < expected;
                            const isComplete = filled > 0 && filled >= expected;
                            
                            return (
                              <Badge variant={isComplete ? "default" : "secondary"} className="flex items-center gap-1">
                                {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                GC {expected > 0 && `(${filled}/${expected})`}
                                {isPartial && " ⚠️"}
                              </Badge>
                            );
                          })()}
                          
                          {/* Points Badge */}
                          {(() => {
                            const filled = status?.nb_lignes_points || 0;
                            const expected = status?.expected_points || 0;
                            const isPartial = filled > 0 && filled < expected;
                            const isComplete = filled > 0 && filled >= expected;
                            
                            return (
                              <Badge variant={isComplete ? "default" : "secondary"} className="flex items-center gap-1">
                                {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                Points {expected > 0 && `(${filled}/${expected})`}
                                {isPartial && " ⚠️"}
                              </Badge>
                            );
                          })()}
                          
                          {/* Montagne Badge */}
                          {(() => {
                            const filled = status?.nb_lignes_montagne || 0;
                            const expected = status?.expected_montagne || 0;
                            const isPartial = filled > 0 && filled < expected;
                            const isComplete = filled > 0 && filled >= expected;
                            
                            return (
                              <Badge variant={isComplete ? "default" : "secondary"} className="flex items-center gap-1">
                                {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                Montagne {expected > 0 && `(${filled}/${expected})`}
                                {isPartial && " ⚠️"}
                              </Badge>
                            );
                          })()}
                          
                          {/* Jeune Badge */}
                          {(() => {
                            const filled = status?.nb_lignes_jeune || 0;
                            const expected = status?.expected_jeune || 0;
                            const isPartial = filled > 0 && filled < expected;
                            const isComplete = filled > 0 && filled >= expected;
                            
                            return (
                              <Badge variant={isComplete ? "default" : "secondary"} className="flex items-center gap-1">
                                {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                Jeune {expected > 0 && `(${filled}/${expected})`}
                                {isPartial && " ⚠️"}
                              </Badge>
                            );
                          })()}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        {status?.nb_lignes_gc ? (
                          <Badge variant="default" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Résultat saisi
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            À saisir
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedCourse && studioOpen && (
        <ResultsEntryStudio
          course={selectedCourse}
          mode={studioMode}
          onClose={() => setStudioOpen(false)}
        />
      )}

      {selectedPhase && (
        <BonusEntryDialog
          open={bonusDialogOpen}
          onOpenChange={setBonusDialogOpen}
          phaseId={selectedPhase}
        />
      )}
    </div>
  );
};

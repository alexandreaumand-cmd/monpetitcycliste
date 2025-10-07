import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ResultsEntryStudio } from "./ResultsEntryStudio";
import { Calendar, Trophy, ChevronRight, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { normalizeCourseType, isStageRace } from "@/lib/courseType";
import { MobileCard, MobileEmptyState } from "@/components/mobile";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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

export const RecentResultsMobile = () => {
  type ViewMode = '30days' | 'phase';
  const [viewMode, setViewMode] = useState<ViewMode>('30days');
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [studioMode, setStudioMode] = useState<'create' | 'edit'>('create');
  const [studioOpen, setStudioOpen] = useState(false);

  // Fetch phases
  const { data: phases } = useQuery({
    queryKey: ['phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('id, index_dans_saison, date_debut, date_fin, statut')
        .order('index_dans_saison', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch recent courses
  const { data: recentCourses, isLoading } = useQuery({
    queryKey: ['recent-courses', viewMode, selectedPhase],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select('*')
        .order('date_debut', { ascending: false });
      
      if (viewMode === '30days') {
        query = query
          .gte('date_fin', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .lte('date_debut', new Date().toISOString().split('T')[0]);
      } else if (viewMode === 'phase' && selectedPhase) {
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

  // Fetch results status
  const { data: resultsStatusMap } = useQuery({
    queryKey: ['results-status', recentCourses?.map(c => c.course_id)],
    queryFn: async () => {
      if (!recentCourses?.length) return {};
      
      const statusMap: Record<string, ResultsStatus> = {};
      
      for (const course of recentCourses) {
        const { data, error } = await supabase
          .from('race_results')
          .select('type_classement, coureur_id, etape_numero')
          .eq('course_id', course.course_id);
        
        if (error) {
          console.error('Error fetching status:', error);
          continue;
        }
        
        statusMap[course.course_id] = {
          nb_lignes_etapes: new Set(data?.filter(r => r.type_classement === 'Etape').map(r => r.etape_numero)).size || 0,
          nb_lignes_gc: data?.filter(r => r.type_classement === 'General' && r.coureur_id).length || 0,
          nb_lignes_points: data?.filter(r => r.type_classement === 'Points' && r.coureur_id).length || 0,
          nb_lignes_montagne: data?.filter(r => r.type_classement === 'Montagne' && r.coureur_id).length || 0,
          nb_lignes_jeune: data?.filter(r => r.type_classement === 'Jeune' && r.coureur_id).length || 0,
        };
      }
      
      return statusMap;
    },
    enabled: !!recentCourses?.length,
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
    <div className="flex flex-col h-full">
      {/* Header sticky */}
      <div className="sticky top-14 z-10 bg-background border-b safe-top">
        <div className="p-4 space-y-3">
          <div>
            <h1 className="text-xl font-bold">Résultats récents</h1>
            <p className="text-xs text-muted-foreground">
              Saisie des résultats
            </p>
          </div>

          {/* Filtres Pills horizontaux */}
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              <Button
                variant={viewMode === '30days' ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode('30days')}
              >
                30 jours
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
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="One day">1 jour</SelectItem>
                <SelectItem value="Stage race">Étapes</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Liste des courses */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredCourses?.length === 0 ? (
          <MobileEmptyState
            icon={<Trophy className="h-16 w-16" />}
            title="Aucune course"
            description={searchFilter ? "Aucune course pour cette recherche" : "Aucune course trouvée"}
            action={
              searchFilter ? (
                <Button variant="outline" onClick={() => setSearchFilter("")}>
                  Réinitialiser
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {filteredCourses?.map((course) => {
              const status = resultsStatusMap?.[course.course_id];
              const courseIsStageRace = isStageRace(course.type_course);
              const hasResults = status?.nb_lignes_gc || status?.nb_lignes_etapes;
              
              return (
                <MobileCard
                  key={course.course_id}
                  title={course.course_nom}
                  subtitle={
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span className="text-xs">
                        {new Date(course.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {course.date_fin !== course.date_debut && 
                          ` → ${new Date(course.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                      </span>
                    </div>
                  }
                  badge={<Badge variant="secondary" className="text-xs">{course.categorie}</Badge>}
                  onClick={() => handleOpenStudio(course, hasResults ? 'edit' : 'create')}
                >
                  {courseIsStageRace && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Étapes</span>
                        <span className="font-medium">{status?.nb_lignes_etapes || 0}/{course.nb_etapes}</span>
                      </div>
                      
                      <div className="flex gap-1.5 flex-wrap">
                        {status?.nb_lignes_gc ? (
                          <Badge variant="default" className="text-xs">GC ✓</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">GC</Badge>
                        )}
                        {status?.nb_lignes_points ? (
                          <Badge variant="default" className="text-xs">Pts ✓</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Pts</Badge>
                        )}
                        {status?.nb_lignes_montagne ? (
                          <Badge variant="default" className="text-xs">Mont ✓</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Mont</Badge>
                        )}
                        {status?.nb_lignes_jeune ? (
                          <Badge variant="default" className="text-xs">Jeune ✓</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Jeune</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {hasResults ? 'Modifier' : 'Saisir'}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </MobileCard>
              );
            })}
          </>
        )}
      </div>

      {selectedCourse && studioOpen && (
        <ResultsEntryStudio
          course={selectedCourse}
          mode={studioMode}
          onClose={() => setStudioOpen(false)}
        />
      )}
    </div>
  );
};

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { ResultsEntryStudio } from "./ResultsEntryStudio";
import { Calendar, Trophy, AlertCircle, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { normalizeCourseType, isStageRace } from "@/lib/courseType";

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
  const [dayRange, setDayRange] = useState(7);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);

  // Fetch recent courses
  const { data: recentCourses, isLoading } = useQuery({
    queryKey: ['recent-courses', dayRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .gte('date_fin', new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lte('date_debut', new Date().toISOString().split('T')[0])
        .order('date_debut', { ascending: false });
      
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
            ? Math.max(1, Math.ceil((new Date(c.date_fin || c.date_debut).getTime() - new Date(c.date_debut).getTime()) / (1000 * 60 * 60 * 24)) + 1)
            : 1,
          phase_id: c.phase_id || '',
          phase_nom: ''
        };
      }) as Course[];
    },
  });

  // Fetch results status for each course
  const { data: resultsStatusMap } = useQuery({
    queryKey: ['results-status', recentCourses?.map(c => c.course_id)],
    queryFn: async () => {
      if (!recentCourses?.length) return {};
      
      const statusMap: Record<string, ResultsStatus> = {};
      
      for (const course of recentCourses) {
        const { data, error } = await supabase
          .from('race_results')
          .select('type_classement')
          .eq('course_id', course.course_id);
        
        if (error) {
          console.error('Error fetching status:', error);
          continue;
        }
        
        statusMap[course.course_id] = {
          nb_lignes_etapes: data?.filter(r => r.type_classement === 'Etape').length || 0,
          nb_lignes_gc: data?.filter(r => r.type_classement === 'General').length || 0,
          nb_lignes_points: data?.filter(r => r.type_classement === 'Points').length || 0,
          nb_lignes_montagne: data?.filter(r => r.type_classement === 'Montagne').length || 0,
          nb_lignes_jeune: data?.filter(r => r.type_classement === 'Jeune').length || 0,
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

  const handleOpenStudio = (course: Course) => {
    setSelectedCourse(course);
    setStudioOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Résultats récents</h2>
          <p className="text-muted-foreground">Saisie des résultats des courses des derniers jours</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex gap-2">
          <Button
            variant={dayRange === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => setDayRange(1)}
          >
            Aujourd'hui
          </Button>
          <Button
            variant={dayRange === 3 ? "default" : "outline"}
            size="sm"
            onClick={() => setDayRange(3)}
          >
            3 jours
          </Button>
          <Button
            variant={dayRange === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setDayRange(7)}
          >
            7 jours
          </Button>
          <Button
            variant={dayRange === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setDayRange(30)}
          >
            30 jours
          </Button>
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
                    <Button onClick={() => handleOpenStudio(course)}>
                      Saisir / Corriger
                    </Button>
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
                          <Badge variant={status?.nb_lignes_gc ? "default" : "secondary"} className="flex items-center gap-1">
                            {status?.nb_lignes_gc ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            GC
                          </Badge>
                          <Badge variant={status?.nb_lignes_points ? "default" : "secondary"} className="flex items-center gap-1">
                            {status?.nb_lignes_points ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            Points
                          </Badge>
                          <Badge variant={status?.nb_lignes_montagne ? "default" : "secondary"} className="flex items-center gap-1">
                            {status?.nb_lignes_montagne ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            Montagne
                          </Badge>
                          <Badge variant={status?.nb_lignes_jeune ? "default" : "secondary"} className="flex items-center gap-1">
                            {status?.nb_lignes_jeune ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            Jeune
                          </Badge>
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
          onClose={() => setStudioOpen(false)}
        />
      )}
    </div>
  );
};

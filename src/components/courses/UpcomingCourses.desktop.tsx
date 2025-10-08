import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Trophy, Clock, MapPin } from "lucide-react";
import { CoursePointsDrawer } from "./CoursePointsDrawer";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { normalizeCourseType, isStageRace } from "@/lib/courseType";
import { useSeasonContext } from "@/contexts/SeasonContext";

interface CourseData {
  course_id: string;
  nom: string;
  categorie: string;
  categorie_for_points: string;
  type_course: string;
  date_debut: string;
  date_fin: string;
  phase_index: number;
  nb_jours: number;
  nb_etapes_estimees: number;
  points_total: number;
  points_etapes: number;
  points_gc: number;
  points_pts: number;
  points_mont: number;
  points_jeune: number;
  points_etapes_unitaire: number;
  is_uwt: boolean;
  wt_tier: string | null;
}

export const UpcomingCourses = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);
  const { selectedSeason, phases } = useSeasonContext();

  const seasonPhaseIds = phases?.map(p => p.id) || [];

  const { data: courses, isLoading } = useQuery({
    queryKey: ['all-courses', selectedSeason?.id],
    queryFn: async () => {
      if (!selectedSeason || seasonPhaseIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('v_course_points_theoriques')
        .select('*')
        .in('phase_id', seasonPhaseIds)
        .order('date_debut', { ascending: false });
      
      if (error) throw error;
      return data as CourseData[];
    },
    enabled: !!selectedSeason && seasonPhaseIds.length > 0,
  });

  const filteredCourses = courses?.filter(course => {
    const matchesSearch = course.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPhase = phaseFilter === "all" || course.phase_index?.toString() === phaseFilter;
    
    return matchesSearch && matchesPhase;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Toutes les courses de la saison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Rechercher une course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {phases?.map(p => (
                  <SelectItem key={p.index_dans_saison} value={p.index_dans_saison.toString()}>
                    Phase {p.index_dans_saison}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Courses List */}
      {!filteredCourses || filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Aucune course trouvée avec les filtres sélectionnés.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map(course => {
            const daysUntil = differenceInDays(new Date(course.date_debut), new Date());
            const daysLabel = daysUntil === 0 ? "Aujourd'hui" : `J-${daysUntil}`;
            const normalized = normalizeCourseType(course.type_course);
            const etapesLabel = normalized.isStage
              ? `${course.nb_etapes_estimees} étapes` 
              : "Course d'un jour";

            return (
              <Card key={course.course_id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedCourse(course)}>
                <CardHeader>
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{course.nom}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {course.phase_index && (
                        <Badge variant="secondary">Phase {course.phase_index}</Badge>
                      )}
                      <Badge variant="outline">{course.categorie}</Badge>
                      <Badge variant="outline">{normalized.display}</Badge>
                      {course.is_uwt && course.points_total === 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <span>⚠️</span>
                          Config UWT
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(course.date_debut), 'dd MMM', { locale: fr })}
                        {course.date_fin && course.date_fin !== course.date_debut && (
                          <> → {format(new Date(course.date_fin), 'dd MMM', { locale: fr })}</>
                        )}
                        {' '}({course.nb_jours}j)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{daysLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{etapesLabel}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        <span className="text-2xl font-bold text-primary">
                          {course.points_total || 0}
                        </span>
                        <span className="text-sm text-muted-foreground">pts</span>
                      </div>
                      <span className="text-xs text-primary hover:underline">
                        Voir détail →
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CoursePointsDrawer 
        course={selectedCourse} 
        open={!!selectedCourse}
        onOpenChange={(open) => !open && setSelectedCourse(null)}
      />
    </div>
  );
};

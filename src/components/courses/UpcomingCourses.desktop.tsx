import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Trophy, Clock, MapPin, XCircle } from "lucide-react";
import { CoursePointsDrawer } from "./CoursePointsDrawer";
import { format, differenceInCalendarDays } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { normalizeCourseType, isStageRace } from "@/lib/courseType";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { UI_CONSTANTS } from "@/lib/ui-constants";
import { useTranslation } from "react-i18next";

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
  is_cancelled?: boolean;
}

export const UpcomingCourses = () => {
  const { t, i18n } = useTranslation('calendar');
  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);
  const { selectedSeason, phases, isLoading: isLoadingContext } = useSeasonContext();
  const { leagueId } = useLeague();
  
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const seasonPhaseIds = phases?.map(p => p.id) || [];

  const { data: courses, isLoading } = useQuery({
    queryKey: ['league-courses', leagueId, selectedSeason?.id],
    queryFn: async () => {
      if (!leagueId) return [];
      
      console.log('[UpcomingCourses] Loading courses for league:', leagueId, 'season:', selectedSeason?.id);
      
      const { data, error } = await supabase.functions.invoke('get-league-courses', {
        body: {
          league_id: leagueId,
          season_id: selectedSeason?.id || null
        }
      });
      
      if (error) {
        console.error('[UpcomingCourses] Error loading courses:', error);
        throw error;
      }

      console.log('[UpcomingCourses] Loaded courses:', data?.courses?.length);

      // Check cancelled status for each course
      const coursesWithStatus = await Promise.all(
        (data.courses || []).map(async (course: any) => {
          const { count } = await supabase
            .from('race_result_sets')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.course_id)
            .eq('type_classement', 'General')
            .eq('is_cancelled', true);
      
          return {
            ...course,
            is_cancelled: (count ?? 0) > 0
          } as CourseData;
        })
      );

      return coursesWithStatus;
    },
    enabled: !!leagueId && !isLoadingContext,
  });

  const filteredCourses = courses
    ?.filter(course => {
      const matchesSearch = course.nom.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPhase = phaseFilter === "all" || course.phase_index?.toString() === phaseFilter;
      return matchesSearch && matchesPhase;
    })
    ?.sort((a, b) => a.date_debut.localeCompare(b.date_debut));

  if (isLoading || isLoadingContext) {
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
    <PageContainer>
      <PageHeader
        icon={Calendar}
        title={t('courses.title')}
        filters={
          <>
            <Input
              placeholder={t('courses.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={UI_CONSTANTS.filterWidth}
            />
            
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className={UI_CONSTANTS.filterWidth}>
                <SelectValue placeholder={t('filters.allPhases')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('courses.allPhases')}</SelectItem>
                {phases?.map(p => (
                  <SelectItem key={p.index_dans_saison} value={p.index_dans_saison.toString()}>
                    Phase {p.index_dans_saison}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Courses List */}
      {!filteredCourses || filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {t('courses.noCoursesFound')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid ${UI_CONSTANTS.gridCols} ${UI_CONSTANTS.gridGap}`}>
          {filteredCourses.map(course => {
            const daysUntil = differenceInCalendarDays(new Date(course.date_debut), new Date());
            const daysLabel = daysUntil === 0 
              ? t('courses.today') 
              : daysUntil === 1 
                ? t('courses.tomorrow') 
                : t('courses.daysUntil', { count: daysUntil });
            const normalized = normalizeCourseType(course.type_course);
            const etapesLabel = normalized.isStage
              ? `${course.nb_etapes_estimees} ${t('courses.stages')}` 
              : t('courses.oneDay');

            return (
              <Card key={course.course_id} className={`${UI_CONSTANTS.cardHover} cursor-pointer`} onClick={() => setSelectedCourse(course)}>
                <CardHeader>
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{course.nom}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {course.is_cancelled && (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          {t('courses.cancelled')}
                        </Badge>
                      )}
                      {course.phase_index && (
                        <Badge variant="secondary">Phase {course.phase_index}</Badge>
                      )}
                      <Badge variant="outline">{course.categorie}</Badge>
                      <Badge variant="outline">{normalized.display}</Badge>
                      {course.is_uwt && course.points_total === 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <span>⚠️</span>
                          {t('courses.configUWT')}
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
                        {format(new Date(course.date_debut), 'dd MMM', { locale: dateLocale })}
                        {course.date_fin && course.date_fin !== course.date_debut && (
                          <> → {format(new Date(course.date_fin), 'dd MMM', { locale: dateLocale })}</>
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
                        <span className="text-sm text-muted-foreground">{t('courses.pts')}</span>
                      </div>
                      <span className="text-xs text-primary hover:underline">
                        {t('courses.viewDetails')}
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
    </PageContainer>
  );
};

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trophy, Clock, MapPin, Search } from "lucide-react";
import { CoursePointsDrawer } from "./CoursePointsDrawer";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { normalizeCourseType } from "@/lib/courseType";
import { MobileCard, ChipGroup, MobileEmptyState } from "@/components/mobile";
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

export const UpcomingCoursesMobile = () => {
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

  const phaseItems = [
    { value: "all", label: "Toutes" },
    ...(phases?.map(p => ({ value: p.index_dans_saison.toString(), label: `Phase ${p.index_dans_saison}` })) || [])
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-14 z-10 bg-background border-b safe-top">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Toutes les courses</h1>
            {filteredCourses && (
              <span className="text-xs text-muted-foreground">{filteredCourses.length} courses</span>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <ChipGroup
            items={phaseItems}
            selected={phaseFilter}
            onSelect={setPhaseFilter}
          />
        </div>
      </div>

      {/* Liste des courses */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !filteredCourses || filteredCourses.length === 0 ? (
          <MobileEmptyState
            icon={<Calendar className="h-16 w-16" />}
            title="Aucune course"
            description="Aucune course à venir avec ces filtres"
          />
        ) : (
          filteredCourses.map(course => {
            const daysUntil = differenceInDays(new Date(course.date_debut), new Date());
            const daysLabel = daysUntil === 0 ? "Aujourd'hui" : daysUntil === 1 ? "Demain" : `J-${daysUntil}`;
            const normalized = normalizeCourseType(course.type_course);
            const etapesLabel = normalized.isStage
              ? `${course.nb_etapes_estimees} étapes` 
              : "Course d'un jour";

            return (
              <MobileCard
                key={course.course_id}
                title={course.nom}
                subtitle={
                  <div className="space-y-1.5 mt-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {format(new Date(course.date_debut), 'dd MMM', { locale: fr })}
                        {course.date_fin && course.date_fin !== course.date_debut && (
                          <> → {format(new Date(course.date_fin), 'dd MMM', { locale: fr })}</>
                        )}
                        {' '}({course.nb_jours}j)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{etapesLabel}</span>
                    </div>
                  </div>
                }
                badge={
                  <div className="flex items-center gap-1 text-primary font-bold">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>{course.points_total || 0}</span>
                  </div>
                }
                onClick={() => setSelectedCourse(course)}
              >
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <Badge variant="secondary" className="text-xs h-5">
                    Phase {course.phase_index}
                  </Badge>
                  <Badge variant="outline" className="text-xs h-5">
                    {course.categorie}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">{daysLabel}</span>
                  </div>
                  {course.is_uwt && course.points_total === 0 && (
                    <Badge variant="destructive" className="text-xs h-5 gap-1">
                      <span>⚠️</span>
                      Config
                    </Badge>
                  )}
                </div>
              </MobileCard>
            );
          })
        )}
      </div>

      <CoursePointsDrawer 
        course={selectedCourse} 
        open={!!selectedCourse}
        onOpenChange={(open) => !open && setSelectedCourse(null)}
      />
    </div>
  );
};

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trophy, TrendingUp, Mountain, Award, Star, Users, Image, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { isStageRace } from "@/lib/courseType";
import { PointsBaremeSection } from "@/components/courses/PointsBaremeSection";
import { useTranslation } from "react-i18next";

type TypeClassement = "Etape" | "General" | "Points" | "Montagne" | "Jeune";

interface CalendarCourseData {
  course_id: string;
  nom: string;
  categorie: string | null;
  date_debut: string | null;
  date_fin: string | null;
  phase_id: string | null;
  total_points: number;
}

interface CalendarCourseDrawerProps {
  course: CalendarCourseData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StartlistEntry {
  line_no: number;
  source_name: string;
  source_team: string | null;
  coureur_id: string | null;
  coureur?: { nom: string } | null;
  equipe?: { nom_affiche: string } | null;
}

export const CalendarCourseDrawer = ({ course, open, onOpenChange }: CalendarCourseDrawerProps) => {
  const { t } = useTranslation('calendar');
  const [imageError, setImageError] = useState(false);
  const [pointsBreakdownOpen, setPointsBreakdownOpen] = useState(true);

  // Fetch detailed course data from v_course_points_theoriques
  const { data: courseDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["calendar-course-details", course?.course_id],
    queryFn: async () => {
      if (!course?.course_id) return null;
      const { data, error } = await supabase
        .from("v_course_points_theoriques")
        .select("*")
        .eq("course_id", course.course_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!course?.course_id,
  });

  // Fetch latest startlist import for this course
  const { data: startlistImport } = useQuery({
    queryKey: ["calendar-startlist-import", course?.course_id],
    queryFn: async () => {
      if (!course?.course_id) return null;
      const { data, error } = await supabase
        .from("startlist_imports")
        .select("id, route_image_url, created_at")
        .eq("race_id", course.course_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: open && !!course?.course_id,
  });

  // Fetch startlist entries
  const { data: startlistData, isLoading: loadingStartlist } = useQuery({
    queryKey: ["calendar-startlist-entries", startlistImport?.id],
    queryFn: async () => {
      if (!startlistImport?.id) return null;
      
      const response = await supabase.functions.invoke("startlist-entries-list", {
        body: { startlist_id: startlistImport.id },
      });
      
      if (response.error) throw response.error;
      return response.data as {
        entries: StartlistEntry[];
        stats: { total: number; matched: number; unmatched: number };
      };
    },
    enabled: open && !!startlistImport?.id,
  });

  // Sort startlist entries by team trigramme
  const sortedStartlistEntries = useMemo(() => {
    if (!startlistData?.entries) return [];
    return [...startlistData.entries].sort((a, b) => {
      const teamA = (a.equipe?.nom_affiche || a.source_team || "").toLowerCase();
      const teamB = (b.equipe?.nom_affiche || b.source_team || "").toLowerCase();
      return teamA.localeCompare(teamB);
    });
  }, [startlistData?.entries]);

  if (!course) return null;

  const pointsData: {
    label: string;
    points: number;
    icon: typeof TrendingUp;
    color: string;
    bgColor: string;
    detail: string | null;
    typeClassement: TypeClassement;
  }[] = courseDetails ? [
    {
      label: t('drawer.classifications.stages'),
      points: courseDetails.points_etapes || 0,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      detail: isStageRace(courseDetails.type_course || "")
        ? `${courseDetails.nb_etapes_estimees} × ${courseDetails.points_etapes_unitaire} pts`
        : null,
      typeClassement: "Etape"
    },
    {
      label: t('drawer.classifications.gc'),
      points: courseDetails.points_gc || 0,
      icon: Trophy,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      detail: null,
      typeClassement: "General"
    },
    {
      label: t('drawer.classifications.points'),
      points: courseDetails.points_pts || 0,
      icon: Award,
      color: "text-green-600",
      bgColor: "bg-green-100",
      detail: null,
      typeClassement: "Points"
    },
    {
      label: t('drawer.classifications.mountain'),
      points: courseDetails.points_mont || 0,
      icon: Mountain,
      color: "text-red-600",
      bgColor: "bg-red-100",
      detail: null,
      typeClassement: "Montagne"
    },
    {
      label: t('drawer.classifications.youth'),
      points: courseDetails.points_jeune || 0,
      icon: Star,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      detail: null,
      typeClassement: "Jeune"
    }
  ] : [];

  const maxPoints = Math.max(...pointsData.map(d => d.points), 1);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg p-0 flex flex-col h-full">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-xl">{course.nom}</SheetTitle>
          <SheetDescription>{t('drawer.description')}</SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {course.categorie && (
              <Badge variant="outline">{course.categorie}</Badge>
            )}
            {courseDetails?.type_course && (
              <Badge variant="secondary">{courseDetails.type_course}</Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* Total Points */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('drawer.totalPoints')}</span>
                {loadingDetails ? (
                  <Skeleton className="h-9 w-20" />
                ) : (
                  <span className="text-3xl font-bold text-primary">
                    {courseDetails?.points_total || course.total_points || 0}
                  </span>
                )}
              </div>
            </div>

            {/* Points Breakdown */}
            {loadingDetails ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : pointsData.length > 0 && (
              <Collapsible open={pointsBreakdownOpen} onOpenChange={setPointsBreakdownOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between py-2 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
                    <h3 className="font-semibold">{t('drawer.pointsBreakdown')}</h3>
                    {pointsBreakdownOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  {pointsData.map((item, index) => {
                    const Icon = item.icon;
                    const percentage = maxPoints > 0 ? (item.points / maxPoints) * 100 : 0;

                    if (item.points === 0) return null;

                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${item.bgColor}`}>
                              <Icon className={`h-4 w-4 ${item.color}`} />
                            </div>
                            <span className="font-medium text-sm">{item.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold">{item.points}</span>
                            {item.detail && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({item.detail})
                              </span>
                            )}
                          </div>
                        </div>
                        <Progress value={percentage} className="h-2" />
                        <PointsBaremeSection 
                          courseId={course.course_id} 
                          typeClassement={item.typeClassement}
                        />
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Route Image */}
            {startlistImport?.route_image_url && !imageError && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  {t('drawer.route')}
                </h3>
                <a 
                  href={startlistImport.route_image_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img 
                    src={startlistImport.route_image_url} 
                    alt={t('drawer.route')}
                    className="w-full rounded-lg border hover:opacity-90 transition-opacity cursor-zoom-in"
                    onError={() => setImageError(true)}
                  />
                </a>
              </div>
            )}

            {/* Startlist */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('drawer.registeredRiders')}
                {startlistData?.stats && (
                  <Badge variant="outline" className="ml-2">
                    {startlistData.stats.total}
                  </Badge>
                )}
              </h3>

              {loadingStartlist ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : sortedStartlistEntries.length > 0 ? (
                <>
                  {/* Stats */}
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>{startlistData?.stats.matched} {t('drawer.matched')}</span>
                    </div>
                    {startlistData?.stats.unmatched && startlistData.stats.unmatched > 0 && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>{startlistData.stats.unmatched} {t('drawer.unmatched')}</span>
                      </div>
                    )}
                  </div>

                  {/* Entries List */}
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {sortedStartlistEntries.map((entry, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-muted/50"
                      >
                        <span className="text-muted-foreground w-8 text-right font-mono">
                          #{entry.line_no}
                        </span>
                        <span className="flex-1 truncate">
                          {entry.coureur?.nom || entry.source_name}
                        </span>
                        <span className="text-muted-foreground text-xs truncate max-w-[100px]">
                          {entry.equipe?.nom_affiche || entry.source_team || ""}
                        </span>
                        {entry.coureur_id ? (
                          <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('drawer.noStartlist')}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

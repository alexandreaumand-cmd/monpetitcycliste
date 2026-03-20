import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trophy, TrendingUp, Mountain, Award, Star, Users, Image, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { isStageRace, normalizeCourseType } from "@/lib/courseType";
import { PointsBaremeSection } from "@/components/courses/PointsBaremeSection";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

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

interface CalendarCourseDialogProps {
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

const RiderRow = ({ entry }: { entry: StartlistEntry }) => (
  <div className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50 transition-colors">
    <span className="text-muted-foreground w-6 text-right font-mono text-xs">
      #{entry.line_no}
    </span>
    <span className="flex-1 truncate font-medium text-sm">
      {entry.coureur?.nom || entry.source_name}
    </span>
    {entry.coureur_id ? (
      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
    ) : (
      <AlertCircle className="h-3 w-3 text-bordure-gold flex-shrink-0" />
    )}
  </div>
);

export const CalendarCourseDialog = ({ course, open, onOpenChange }: CalendarCourseDialogProps) => {
  const { t, i18n } = useTranslation('calendar');
  const [imageError, setImageError] = useState(false);
  const [pointsBreakdownOpen, setPointsBreakdownOpen] = useState(false);

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
        .select("id, created_at")
        .eq("race_id", course.course_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: open && !!course?.course_id,
  });

  // Fetch route image directly from courses table
  const { data: courseRouteImage } = useQuery({
    queryKey: ["calendar-course-route-image", course?.course_id],
    queryFn: async () => {
      if (!course?.course_id) return null;
      const { data, error } = await supabase
        .from("courses")
        .select("route_image_url")
        .eq("id", course.course_id)
        .single();
      if (error) throw error;
      return data?.route_image_url;
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

  // Group startlist entries by team
  const groupedStartlistEntries = useMemo(() => {
    if (!startlistData?.entries) return [];
    const groups: Record<string, StartlistEntry[]> = {};
    for (const entry of startlistData.entries) {
      const team = entry.equipe?.nom_affiche || entry.source_team || "Sans équipe";
      if (!groups[team]) groups[team] = [];
      groups[team].push(entry);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([team, entries]) => ({
        team,
        entries: entries.sort((a, b) => a.line_no - b.line_no),
      }));
  }, [startlistData?.entries]);

  if (!course) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return format(parseISO(dateStr), "d MMM yyyy", { locale: i18n.language === 'fr' ? fr : undefined });
  };

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
      color: "text-bordure-gold",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="text-xl font-semibold">{course.nom}</DialogTitle>
          <DialogDescription className="sr-only">{t('drawer.description')}</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {course.categorie && (
              <Badge variant="outline">{course.categorie}</Badge>
            )}
            {courseDetails?.type_course && (
              <Badge variant="secondary">{normalizeCourseType(courseDetails.type_course).display}</Badge>
            )}
            {(course.date_debut || course.date_fin) && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {formatDate(course.date_debut)}
                  {course.date_fin && course.date_fin !== course.date_debut && (
                    <> → {formatDate(course.date_fin)}</>
                  )}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 p-6">
            {/* Left Column - Points & Route */}
            <div className="space-y-4">
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

              {/* Points Breakdown - Collapsible */}
              {!loadingDetails && pointsData.filter(p => p.points > 0).length > 0 && (
                <Collapsible open={pointsBreakdownOpen} onOpenChange={setPointsBreakdownOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors">
                      <span className="font-medium text-sm">{t('drawer.pointsBreakdown')}</span>
                      {pointsBreakdownOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    {pointsData.map((item, index) => {
                      const Icon = item.icon;
                      const percentage = maxPoints > 0 ? (item.points / maxPoints) * 100 : 0;

                      if (item.points === 0) return null;

                      return (
                        <div key={index} className="space-y-1.5 p-2 rounded-md bg-background border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${item.bgColor}`}>
                                <Icon className={`h-3 w-3 ${item.color}`} />
                              </div>
                              <span className="text-sm">{item.label}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-sm">{item.points}</span>
                              {item.detail && (
                                <span className="text-xs text-muted-foreground ml-1.5">
                                  ({item.detail})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary/60 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
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
              {courseRouteImage && !imageError && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    {t('drawer.route')}
                  </h3>
                  <a 
                    href={courseRouteImage} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img 
                      src={courseRouteImage} 
                      alt={t('drawer.route')}
                      className="w-full rounded-lg border hover:opacity-90 transition-opacity cursor-zoom-in"
                      onError={() => setImageError(true)}
                    />
                  </a>
                </div>
              )}
            </div>

            {/* Right Column - Startlist (More prominent) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('drawer.registeredRiders')}
                  {startlistData?.stats && (
                    <Badge variant="secondary" className="ml-1">
                      {startlistData.stats.total}
                    </Badge>
                  )}
                </h3>
                {startlistData?.stats && (
                  <div className="flex gap-3 text-xs">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      <span>{startlistData.stats.matched}</span>
                    </div>
                    {startlistData.stats.unmatched > 0 && (
                      <div className="flex items-center gap-1 text-bordure-gold">
                        <AlertCircle className="h-3 w-3" />
                        <span>{startlistData.stats.unmatched}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {loadingStartlist ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : groupedStartlistEntries.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[550px] overflow-y-auto p-3 space-y-4">
                    {groupedStartlistEntries.map(({ team, entries }) => {
                      const half = Math.ceil(entries.length / 2);
                      const col1 = entries.slice(0, half);
                      const col2 = entries.slice(half);
                      return (
                        <div key={team}>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 px-1 border-b pb-1">
                            {team} <span className="text-muted-foreground/60">({entries.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                            <div>
                              {col1.map((entry, idx) => (
                                <RiderRow key={idx} entry={entry} />
                              ))}
                            </div>
                            <div>
                              {col2.map((entry, idx) => (
                                <RiderRow key={idx} entry={entry} />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('drawer.noStartlist')}</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

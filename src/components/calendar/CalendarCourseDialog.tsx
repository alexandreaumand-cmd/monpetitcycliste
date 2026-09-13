import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trophy, TrendingUp, Mountain, Award, Star, Users, Image, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Calendar, ShieldCheck, ArrowDownUp, Plus, Minus, List, Bike } from "lucide-react";
import { isStageRace, normalizeCourseType } from "@/lib/courseType";
import { useStageDates } from "@/hooks/useStageDates";
import { Coffee } from "lucide-react";
import { PointsBaremeSection } from "@/components/courses/PointsBaremeSection";
import { RouteImageGallery } from "@/components/startlist/RouteImageGallery";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useCurrentManager } from "@/hooks/useCurrentManager";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


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
  team_confirmed?: boolean;
  coureurs?: { nom: string; equipe: string } | null;
}

interface StartlistStats {
  total: number;
  matched: number;
  unmatched: number;
  confirmed_riders?: number;
  confirmed_teams?: number;
  total_teams?: number;
}

interface RiderRowProps {
  entry: StartlistEntry;
  isFavorite: boolean;
  canFavorite: boolean;
  onToggleFavorite: () => void;
}

const RiderRow = ({ entry, isFavorite, canFavorite, onToggleFavorite }: RiderRowProps) => {
  const { t } = useTranslation('calendar');
  return (
    <div className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50 transition-colors">
      <span className="text-muted-foreground w-6 text-right font-mono text-xs">
        #{entry.line_no}
      </span>
      {entry.team_confirmed && (
        <ShieldCheck className="h-3 w-3 text-green-500 flex-shrink-0" />
      )}
      <span className="flex-1 truncate font-medium text-sm">
        {entry.coureurs?.nom || entry.source_name}
      </span>
      {!entry.coureur_id && (
        <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
      )}
      {canFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="flex-shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
          aria-label={isFavorite ? t('drawer.favorites.remove') : t('drawer.favorites.add')}
          title={isFavorite ? t('drawer.favorites.remove') : t('drawer.favorites.add')}
        >
          <Star className={cn("h-3.5 w-3.5", isFavorite ? "fill-yellow-400 text-bordure-gold" : "text-muted-foreground/50")} />
        </button>
      )}
    </div>
  );
};

interface MovementItem {
  id: string;
  change_type: string;
  rider_name: string;
  team_name: string | null;
  coureur_id: string | null;
  detected_at: string;
}

interface MovementsCompactProps {
  items: MovementItem[];
  isLoading: boolean;
  resolveTeam: (item: MovementItem) => string;
  scrollMaxClass?: string;
}

const StartlistMovementsCompact = ({ items, isLoading, resolveTeam, scrollMaxClass = "max-h-[460px]" }: MovementsCompactProps) => {
  const { t } = useTranslation('calendar');

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground italic px-1 py-2">
        {t('drawer.movements.empty')}
      </p>
    );
  }

  return (
    <div className={cn("space-y-1 overflow-y-auto pr-1", scrollMaxClass)}>
      {items.map((item) => {
        const team = resolveTeam(item) || t('drawer.movements.noTeam');
        return (
          <div
            key={item.id}
            className="flex items-start gap-2 py-1.5 px-1.5 rounded hover:bg-muted/50 transition-colors"
          >
            {item.change_type === "added" ? (
              <span className="flex-shrink-0 rounded-full p-0.5 bg-green-500/15 text-green-600 dark:text-green-400 mt-0.5" title={t('drawer.movements.added')}>
                <Plus className="h-3 w-3" />
              </span>
            ) : (
              <span className="flex-shrink-0 rounded-full p-0.5 bg-red-500/15 text-red-600 dark:text-red-400 mt-0.5" title={t('drawer.movements.removed')}>
                <Minus className="h-3 w-3" />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm leading-tight truncate">{item.rider_name}</div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground truncate min-w-0">{team}</span>
                <span className="text-[10px] text-muted-foreground/80 whitespace-nowrap flex-shrink-0">
                  {format(new Date(item.detected_at), "dd MMM HH:mm", { locale: fr })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

};

export const CalendarCourseDialog = ({ course, open, onOpenChange }: CalendarCourseDialogProps) => {
  const { t, i18n } = useTranslation('calendar');
  const queryClient = useQueryClient();
  const { data: currentManager } = useCurrentManager();
  const { selectedSeason } = useSeasonContext();
  const managerId = currentManager?.id;
  const [imageError, setImageError] = useState(false);
  const [pointsBreakdownOpen, setPointsBreakdownOpen] = useState(false);
  const [mobileMovementsOpen, setMobileMovementsOpen] = useState(false);
  const [showProgramme, setShowProgramme] = useState(true);
  const [showParcours, setShowParcours] = useState(true);
  const [showRiders, setShowRiders] = useState(true);


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

  // Stage dates (rest days) — only useful for stage races
  const stageRaceIds = useMemo(
    () => (course?.course_id && isStageRace(courseDetails?.type_course || "")) ? [course.course_id] : [],
    [course?.course_id, courseDetails?.type_course],
  );
  const { getStageDates, isRestDay } = useStageDates(stageRaceIds);
  const programme = useMemo(() => {
    if (!course?.course_id || !course.date_debut || !course.date_fin) return null;
    if (!isStageRace(courseDetails?.type_course || "")) return null;
    const set = getStageDates(course.course_id);
    if (set.size === 0) return null;
    const out: { date: string; etape: number | null }[] = [];
    const start = new Date(course.date_debut + "T00:00:00Z");
    const end = new Date(course.date_fin + "T00:00:00Z");
    const sortedDates = Array.from(set).sort();
    const dateToEtape = new Map<string, number>();
    sortedDates.forEach((d, i) => dateToEtape.set(d, i + 1));
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().split("T")[0];
      const rest = isRestDay(course.course_id, iso, course.date_debut, course.date_fin);
      out.push({ date: iso, etape: rest ? null : (dateToEtape.get(iso) ?? null) });
    }
    return out;
  }, [course?.course_id, course?.date_debut, course?.date_fin, courseDetails?.type_course, getStageDates, isRestDay]);

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

  // Fetch route image (fallback) + multi-stage images
  const { data: routeData } = useQuery({
    queryKey: ["calendar-course-route", course?.course_id],
    queryFn: async () => {
      if (!course?.course_id) return { fallback: null as string | null, images: [] as Array<{ etape_numero: number | null; image_url: string; label: string | null; sort_order: number }> };
      const [{ data: courseRow }, { data: stageImages }] = await Promise.all([
        supabase.from("courses").select("route_image_url").eq("id", course.course_id).single(),
        supabase
          .from("course_route_images")
          .select("etape_numero, image_url, label, sort_order")
          .eq("course_id", course.course_id)
          .order("sort_order", { ascending: true }),
      ]);
      return {
        fallback: courseRow?.route_image_url || null,
        images: stageImages || [],
      };
    },
    enabled: open && !!course?.course_id,
  });
  const courseRouteImage = routeData?.fallback || null;
  const stageRouteImages = routeData?.images || [];
  const hasAnyRouteImage = !!courseRouteImage || stageRouteImages.length > 0;

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
        stats: StartlistStats;
      };
    },
    enabled: open && !!startlistImport?.id,
  });

  // Fetch startlist tracker movements for this course
  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ["calendar-course-movements", course?.course_id],
    queryFn: async () => {
      if (!course?.course_id) return [];
      const { data, error } = await supabase
        .from("startlist_tracker_changes")
        .select("id, change_type, rider_name, team_name, coureur_id, detected_at")
        .eq("course_id", course.course_id)
        .order("detected_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as MovementItem[];
    },
    enabled: open && !!course?.course_id,
  });

  // Fallback team resolution for movements with null team_name
  const movementCoureurIdsWithoutTeam = useMemo(() => {
    if (!movements) return [];
    return movements.filter(m => !m.team_name && m.coureur_id).map(m => m.coureur_id!);
  }, [movements]);

  const { data: coureurEquipeMap } = useQuery({
    queryKey: ["calendar-movement-team-fallback", movementCoureurIdsWithoutTeam, selectedSeason?.id],
    queryFn: async () => {
      if (!movementCoureurIdsWithoutTeam.length || !selectedSeason?.id) return new Map<string, string>();

      const { data: csData } = await supabase
        .from("coureurs_saisons")
        .select("coureur_id, equipe_id")
        .in("coureur_id", movementCoureurIdsWithoutTeam)
        .eq("saison_id", selectedSeason.id);

      if (!csData?.length) return new Map<string, string>();

      const equipeIds = [...new Set(csData.map(c => c.equipe_id))];

      const { data: esData } = await supabase
        .from("equipes_saisons")
        .select("equipe_id, nom_affiche")
        .in("equipe_id", equipeIds)
        .eq("saison_id", selectedSeason.id);

      const equipeNameMap = new Map<string, string>();
      (esData || []).forEach(e => equipeNameMap.set(e.equipe_id, e.nom_affiche));

      const map = new Map<string, string>();
      csData.forEach(c => {
        const nom = equipeNameMap.get(c.equipe_id);
        if (nom) map.set(c.coureur_id, nom);
      });
      return map;
    },
    enabled: movementCoureurIdsWithoutTeam.length > 0 && !!selectedSeason?.id,
  });

  const resolveTeam = (item: MovementItem) =>
    item.team_name || (item.coureur_id ? coureurEquipeMap?.get(item.coureur_id) : null) || "";

  // Fetch user's favorites
  const { data: favoritesSet } = useQuery({
    queryKey: ["rider-favorites", managerId],
    queryFn: async () => {
      if (!managerId) return new Set<string>();
      const { data } = await supabase
        .from("rider_favorites")
        .select("coureur_id")
        .eq("manager_id", managerId);
      return new Set((data || []).map(f => f.coureur_id));
    },
    enabled: !!managerId,
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ coureurId, isFavorite }: { coureurId: string; isFavorite: boolean }) => {
      if (!managerId) throw new Error("Not logged in");
      if (isFavorite) {
        const { error } = await supabase
          .from("rider_favorites")
          .delete()
          .eq("manager_id", managerId)
          .eq("coureur_id", coureurId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rider_favorites")
          .insert({ manager_id: managerId, coureur_id: coureurId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rider-favorites", managerId] });
      queryClient.invalidateQueries({ queryKey: ["riders-data"] });
    },
    onError: (error) => {
      toast.error(t('drawer.favorites.error'));
      console.error(error);
    },
  });

  // Group startlist entries by team
  const groupedStartlistEntries = useMemo(() => {
    if (!startlistData?.entries) return [];
    const groups: Record<string, { entries: StartlistEntry[]; confirmed: boolean }> = {};
    for (const entry of startlistData.entries) {
      const team = entry.coureurs?.equipe || entry.source_team || "Sans équipe";
      if (!groups[team]) groups[team] = { entries: [], confirmed: false };
      groups[team].entries.push(entry);
      if (entry.team_confirmed) groups[team].confirmed = true;
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([team, data]) => ({
        team,
        entries: data.entries.sort((a, b) => a.line_no - b.line_no),
        confirmed: data.confirmed,
      }));
  }, [startlistData?.entries]);

  const movementCount = movements?.length || 0;

  useEffect(() => {
    if (!open) {
      setMobileMovementsOpen(false);
      return;
    }

    if (movementCount > 0) {
      setMobileMovementsOpen(true);
    }
  }, [course?.course_id, movementCount, open]);

  if (!course) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return format(parseISO(dateStr), "d MMM yyyy", { locale: i18n.language === 'fr' ? fr : undefined });
  };

  const renderRiderRow = (entry: StartlistEntry, idx: number) => {
    const isFav = entry.coureur_id ? favoritesSet?.has(entry.coureur_id) ?? false : false;
    const canFav = !!managerId && !!entry.coureur_id;
    return (
      <RiderRow
        key={`${entry.line_no}-${idx}`}
        entry={entry}
        isFavorite={isFav}
        canFavorite={canFav}
        onToggleFavorite={() => {
          if (entry.coureur_id) {
            toggleFavorite.mutate({ coureurId: entry.coureur_id, isFavorite: isFav });
          }
        }}
      />
    );
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
  const stats = startlistData?.stats;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[92vh]">
        <DialogHeader className="border-b bg-muted/30 px-4 pb-3 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
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

        {/* Section visibility toggles */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2 sm:px-6">
          <span className="text-xs text-muted-foreground mr-1">Afficher :</span>
          {programme && programme.length > 0 && (
            <button
              type="button"
              onClick={() => setShowProgramme(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                showProgramme
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-muted-foreground/20 text-muted-foreground line-through"
              )}
            >
              <List className="h-3 w-3" />
              Programme
            </button>
          )}
          {hasAnyRouteImage && !imageError && (
            <button
              type="button"
              onClick={() => setShowParcours(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
                showParcours
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-muted-foreground/20 text-muted-foreground line-through"
              )}
            >
              <Image className="h-3 w-3" />
              Parcours
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowRiders(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
              showRiders
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted border-muted-foreground/20 text-muted-foreground line-through"
            )}
          >
            <Bike className="h-3 w-3" />
            Coureurs inscrits
          </button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className={cn("grid grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6", showRiders ? "lg:grid-cols-[340px_1fr]" : "lg:grid-cols-1")}>
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

              {/* Programme (stage races with configured dates) */}
              {showProgramme && programme && programme.length > 0 && (
                <div className="rounded-lg border bg-card">
                  <div className="px-3 py-2 border-b text-sm font-medium">Programme</div>
                  <div className="max-h-56 overflow-y-auto divide-y">
                    {programme.map((p) => (
                      <div
                        key={p.date}
                        className={cn(
                          "flex items-center justify-between px-3 py-1.5 text-sm",
                          p.etape === null && "text-muted-foreground italic bg-muted/30"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {p.etape === null ? (
                            <><Coffee className="h-3.5 w-3.5" />Repos</>
                          ) : (
                            <>Étape {p.etape}</>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(p.date), "EEE d MMM", { locale: fr })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
              {showParcours && hasAnyRouteImage && !imageError && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    {t('drawer.route')}
                    {stageRouteImages.length > 1 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {stageRouteImages.length} étapes
                      </Badge>
                    )}
                  </h3>
                  <RouteImageGallery
                    images={stageRouteImages}
                    fallbackUrl={courseRouteImage}
                    onImageClick={(url) => window.open(url, "_blank", "noopener,noreferrer")}
                  />
                </div>
              )}

              {/* Startlist movements - Desktop only (always visible in left column) */}
              <div className="hidden lg:block space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2 px-1">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                    {t('drawer.movements.title')}
                  </h3>
                  {movementCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{movementCount}</Badge>
                  )}
                </div>
                <div className="rounded-lg border bg-card p-2">
                  <StartlistMovementsCompact
                    items={movements || []}
                    isLoading={loadingMovements}
                    resolveTeam={resolveTeam}
                  />
                </div>
              </div>
            </div>

            {/* Startlist movements - Mobile, before the long riders list */}
            <div className="lg:hidden">
              <Collapsible open={mobileMovementsOpen} onOpenChange={setMobileMovementsOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors">
                    <span className="font-medium text-sm flex items-center gap-2">
                      <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                      {t('drawer.movements.title')}
                      {movementCount > 0 && (
                        <Badge variant="secondary" className="text-xs">{movementCount}</Badge>
                      )}
                    </span>
                    {mobileMovementsOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="rounded-lg border bg-card p-2">
                    <StartlistMovementsCompact
                      items={movements || []}
                      isLoading={loadingMovements}
                      resolveTeam={resolveTeam}
                      scrollMaxClass="max-h-[400px]"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Right Column - Startlist */}
            {showRiders && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t('drawer.registeredRiders')}
                    {stats && (
                      <Badge variant="secondary" className="ml-1">
                        {stats.total}
                      </Badge>
                    )}
                  </h3>
                </div>

                {/* Stats badges */}
                {stats && (
                  <div className="flex flex-wrap gap-2">
                    {stats.confirmed_teams != null && stats.total_teams != null && stats.total_teams > 0 && (
                      <Badge variant="outline" className="gap-1 text-green-700 border-green-300 bg-green-50">
                        <ShieldCheck className="h-3 w-3" />
                        {t('drawer.confirmedTeams', { count: stats.confirmed_teams, total: stats.total_teams })}
                      </Badge>
                    )}
                    <Badge variant="outline" className="gap-1 text-blue-700 border-blue-300 bg-blue-50">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('drawer.matchedRiders', { count: stats.matched })}
                    </Badge>
                    {stats.unmatched > 0 && (
                      <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
                        <AlertTriangle className="h-3 w-3" />
                        {t('drawer.unmatchedRiders', { count: stats.unmatched })}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Legend */}
                {stats && (stats.confirmed_teams ?? 0) > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5 px-1">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-green-500" />
                      <span>{t('drawer.legendOfficial')}</span>
                    </div>
                    {stats.unmatched > 0 && (
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span>{t('drawer.legendUnmatched')}</span>
                      </div>
                    )}
                  </div>
                )}

                {loadingStartlist ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : groupedStartlistEntries.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="space-y-4 p-3 lg:max-h-[550px] lg:overflow-y-auto">
                      {groupedStartlistEntries.map(({ team, entries, confirmed }) => {
                        const half = Math.ceil(entries.length / 2);
                        const col1 = entries.slice(0, half);
                        const col2 = entries.slice(half);
                        return (
                          <div key={team}>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 px-1 border-b pb-1">
                              {confirmed && <ShieldCheck className="h-3 w-3 text-green-500" />}
                              <span>{team}</span>
                              <span className="text-muted-foreground/60">({entries.length})</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                              <div>
                                {col1.map((entry, idx) => renderRiderRow(entry, idx))}
                              </div>
                              <div>
                                {col2.map((entry, idx) => renderRiderRow(entry, idx + half))}
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
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

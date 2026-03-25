import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function TeamStartlistMovements() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const managerId = searchParams.get("managerId");
  const phaseId = searchParams.get("phaseId");
  const leagueId = searchParams.get("leagueId");
  const managerName = searchParams.get("managerName") || "Équipe";

  // 1. Get coureur_ids from this manager's roster in the league
  const { data: rosterCoureurIds } = useQuery({
    queryKey: ["roster-coureur-ids", managerId, leagueId, phaseId],
    queryFn: async () => {
      if (!managerId || !leagueId || !phaseId) return [];
      const { data } = await supabase
        .from("rosters")
        .select("coureur_id")
        .eq("manager_id", managerId)
        .eq("league_id", leagueId)
        .eq("phase_id", phaseId);
      return (data || []).map((r) => r.coureur_id);
    },
    enabled: !!managerId && !!leagueId && !!phaseId,
  });

  // 1b. Get league scope to filter by selected_course_ids if applicable
  const { data: leagueSelectedCourseIds } = useQuery({
    queryKey: ["league-scope-courses", leagueId],
    queryFn: async () => {
      if (!leagueId) return null;
      const { data } = await supabase
        .from("league_scopes")
        .select("selected_course_ids")
        .eq("league_id", leagueId)
        .single();
      const ids = data?.selected_course_ids as string[] | null;
      return ids?.length ? ids : null;
    },
    enabled: !!leagueId,
  });

  // 2. Get course_ids that belong to the selected phase (filtered by league scope)
  const { data: phaseCourseIds } = useQuery({
    queryKey: ["phase-course-ids", phaseId, leagueSelectedCourseIds],
    queryFn: async () => {
      if (!phaseId) return [];
      let query = supabase.from("courses").select("id");
      if (leagueSelectedCourseIds) {
        query = query.in("id", leagueSelectedCourseIds);
      } else {
        query = query.eq("phase_id", phaseId);
      }
      const { data } = await query;
      return (data || []).map((c) => c.id);
    },
    enabled: !!phaseId && leagueSelectedCourseIds !== undefined,
  });

  // 3. Get startlist changes for these coureurs + courses
  const { data: movements, isLoading } = useQuery({
    queryKey: ["team-startlist-movements", rosterCoureurIds, phaseCourseIds],
    queryFn: async () => {
      if (!rosterCoureurIds?.length || !phaseCourseIds?.length) return [];
      const { data } = await supabase
        .from("startlist_tracker_changes")
        .select("id, coureur_id, rider_name, course_name, change_type, detected_at, course_id")
        .in("coureur_id", rosterCoureurIds)
        .in("course_id", phaseCourseIds)
        .order("detected_at", { ascending: false });
      return data || [];
    },
    enabled: !!rosterCoureurIds?.length && !!phaseCourseIds?.length,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Mouvements startlists</h1>
          <p className="text-sm text-muted-foreground">{managerName}</p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !movements || movements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun mouvement de startlist pour cette équipe sur cette phase.
        </div>
      ) : (
        <div className="space-y-2">
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <div className={`flex-shrink-0 rounded-full p-1.5 ${
                m.change_type === "added" 
                  ? "bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-secondary" 
                  : "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
              }`}>
                {m.change_type === "added" ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.rider_name}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {m.course_name}
                </div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(m.detected_at), "dd MMM HH:mm", { locale: fr })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

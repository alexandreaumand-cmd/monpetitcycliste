import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Loader2, Radio } from "lucide-react";

interface LiveCourseSelectorProps {
  activeCourseId: string | null;
  onSelect: (courseId: string | null) => void;
}

interface LiveCourse {
  id: string;
  course_id: string;
  is_active: boolean;
  courses?: {
    nom: string;
    categorie: string | null;
    date_debut: string | null;
    date_fin: string | null;
    type_course: string | null;
  };
}

export function useLiveCourses() {
  return useQuery({
    queryKey: ["arena-live-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arena_live_courses")
        .select("id, course_id, is_active, courses(nom, categorie, date_debut, date_fin, type_course)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LiveCourse[];
    },
  });
}

export function useActivateLiveCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ courseId, managerId }: { courseId: string; managerId: string }) => {
      const { error } = await supabase.from("arena_live_courses").upsert(
        { course_id: courseId, activated_by: managerId, is_active: true },
        { onConflict: "course_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena-live-courses"] });
    },
  });
}

export function useDeactivateLiveCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("arena_live_courses")
        .update({ is_active: false })
        .eq("course_id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena-live-courses"] });
    },
  });
}

export const LiveCourseSelector = ({
  activeCourseId,
  onSelect,
}: LiveCourseSelectorProps) => {
  const { t } = useTranslation("arena");
  // Auto-select if only one course
  useEffect(() => {
    if (liveCourses?.length === 1 && !activeCourseId) {
      onSelect(liveCourses[0].course_id);
    }
  }, [liveCourses, activeCourseId, onSelect]);

  const { data: liveCourses_unused, isLoading: isLoading_unused } = { data: undefined, isLoading: false };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t("trashTalk.loading")}</span>
      </div>
    );
  }

  if (!liveCourses?.length) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        <p>{t("trashTalk.liveCourses.noCoursesUser")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {t("trashTalk.liveCourses.selectCourse")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {liveCourses.map((lc) => (
          <button
            key={lc.course_id}
            onClick={() =>
              onSelect(activeCourseId === lc.course_id ? null : lc.course_id)
            }
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              activeCourseId === lc.course_id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-foreground border-border hover:border-primary/50"
            )}
          >
            <Radio className="h-3 w-3" />
            <span className="truncate max-w-[150px]">
              {lc.courses?.nom || lc.course_id}
            </span>
            {lc.courses?.categorie && (
              <Badge variant="outline" className="text-[10px] py-0 px-1 ml-0.5">
                {lc.courses.categorie}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

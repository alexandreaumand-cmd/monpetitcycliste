import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Radio, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface LiveCourseSelectorProps {
  activeCourseId: string | null;
  onSelect: (courseId: string | null) => void;
  isSuperAdmin: boolean;
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
  };
}

export function useLiveCourses() {
  return useQuery({
    queryKey: ["arena-live-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arena_live_courses")
        .select("id, course_id, is_active, courses(nom, categorie, date_debut, date_fin)")
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
  isSuperAdmin,
}: LiveCourseSelectorProps) => {
  const { t } = useTranslation("arena");
  const { data: liveCourses, isLoading } = useLiveCourses();

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
        {isSuperAdmin ? (
          <div className="space-y-2">
            <p>{t("trashTalk.liveCourses.noCourses")}</p>
            <AddLiveCourseButton isSuperAdmin={isSuperAdmin} />
          </div>
        ) : (
          <p>{t("trashTalk.liveCourses.noCoursesUser")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("trashTalk.liveCourses.selectCourse")}
        </span>
        {isSuperAdmin && <AddLiveCourseButton isSuperAdmin={isSuperAdmin} />}
      </div>
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

// Super-admin button to add a live course
const AddLiveCourseButton = ({ isSuperAdmin }: { isSuperAdmin: boolean }) => {
  const { t } = useTranslation("arena");
  const [open, setOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const activate = useActivateLiveCourse();
  const deactivate = useDeactivateLiveCourse();
  const { data: liveCourses } = useLiveCourses();

  // Fetch upcoming courses
  const { data: courses } = useQuery({
    queryKey: ["admin-upcoming-courses-live"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, categorie, date_debut, date_fin")
        .or(`date_fin.gte.${today},date_debut.gte.${today}`)
        .order("date_debut", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleActivate = async () => {
    if (!selectedCourseId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: manager } = await supabase
        .from("managers")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (!manager?.id) throw new Error("Manager not found");

      await activate.mutateAsync({ courseId: selectedCourseId, managerId: manager.id });
      toast.success(t("trashTalk.liveCourses.activated"));
      setSelectedCourseId("");
      setOpen(false);
    } catch {
      toast.error(t("trashTalk.liveCourses.activateError"));
    }
  };

  const handleDeactivate = async (courseId: string) => {
    try {
      await deactivate.mutateAsync(courseId);
      toast.success(t("trashTalk.liveCourses.deactivated"));
    } catch {
      toast.error(t("trashTalk.liveCourses.deactivateError"));
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Plus className="h-3 w-3 mr-1" />
          {t("trashTalk.liveCourses.manage")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("trashTalk.liveCourses.manageTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Current live courses */}
          {liveCourses && liveCourses.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium">{t("trashTalk.liveCourses.activeCourses")}</span>
              {liveCourses.map((lc) => (
                <div
                  key={lc.course_id}
                  className="flex items-center justify-between gap-2 p-2 border rounded-lg"
                >
                  <span className="text-sm truncate">
                    {lc.courses?.nom || lc.course_id}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeactivate(lc.course_id)}
                    disabled={deactivate.isPending}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new live course */}
          <div className="space-y-2">
            <span className="text-sm font-medium">{t("trashTalk.liveCourses.addCourse")}</span>
            <div className="flex gap-2">
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("trashTalk.liveCourses.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {courses
                    ?.filter(
                      (c) => !liveCourses?.some((lc) => lc.course_id === c.id)
                    )
                    .map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.nom} {course.categorie ? `(${course.categorie})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleActivate}
                disabled={!selectedCourseId || activate.isPending}
              >
                {activate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

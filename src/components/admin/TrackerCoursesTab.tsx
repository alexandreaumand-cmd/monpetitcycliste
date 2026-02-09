import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, Save, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface CourseInfo {
  id: string;
  nom: string;
  pcs_slug: string | null;
  date_debut: string;
  last_tracker_check: string | null;
  derived_url: string | null;
}

export const TrackerCoursesTab = () => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [editingSlug, setEditingSlug] = useState<Record<string, string>>({});

  const { data: courses, isLoading } = useQuery({
    queryKey: ["tracker-courses-list"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("startlist-tracker", {
        body: { source_type: "list_courses" },
      });
      if (error) throw error;
      return (data.courses || []) as CourseInfo[];
    },
  });

  const updateSlugMutation = useMutation({
    mutationFn: async ({ courseId, slug }: { courseId: string; slug: string }) => {
      // Extract slug from full URL if pasted
      let cleanSlug = slug.trim();
      const urlMatch = cleanSlug.match(/\/race\/([^/]+)/);
      if (urlMatch) cleanSlug = urlMatch[1];

      const { error } = await supabase
        .from("courses")
        .update({ pcs_slug: cleanSlug || null })
        .eq("id", courseId);
      if (error) throw error;
      return cleanSlug;
    },
    onSuccess: (slug, { courseId }) => {
      toast.success(`Slug PCS mis à jour: ${slug || "(vide)"}`);
      setEditingSlug((prev) => {
        const next = { ...prev };
        delete next[courseId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["tracker-courses-list"] });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const getStatusIcon = (course: CourseInfo) => {
    if (!course.derived_url) {
      return <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />;
    }
    return <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="text-sm sm:text-lg">Courses & URLs PCS</CardTitle>
        <p className="text-xs text-muted-foreground">
          Corrigez les slugs PCS pour les courses mal identifiées. Collez l'URL complète ou juste le slug.
        </p>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        <div className="space-y-2">
          {courses?.map((course) => {
            const isEditing = course.id in editingSlug;
            const currentValue = isEditing ? editingSlug[course.id] : (course.pcs_slug || "");

            return (
              <div key={course.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  {getStatusIcon(course)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{course.nom}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {course.date_debut}
                      </Badge>
                    </div>
                    {course.derived_url ? (
                      <a
                        href={course.derived_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                      >
                        {course.derived_url}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-destructive">Aucune URL — slug introuvable</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Slug PCS ou URL complète..."
                    value={currentValue}
                    onChange={(e) =>
                      setEditingSlug((prev) => ({ ...prev, [course.id]: e.target.value }))
                    }
                    className="flex-1 h-8 text-xs"
                  />
                  {isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      disabled={updateSlugMutation.isPending}
                      onClick={() =>
                        updateSlugMutation.mutate({
                          courseId: course.id,
                          slug: editingSlug[course.id],
                        })
                      }
                    >
                      {updateSlugMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      {!isMobile && "Sauver"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, Radio, Plus, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useLiveCourses,
  useActivateLiveCourse,
  useDeactivateLiveCourse,
} from "@/components/arena/LiveCourseSelector";
import { useBroadcastLiveMessage } from "@/hooks/useArenaMessages";
import { useCurrentManagerId, useStartlistRiders } from "@/hooks/useArenaPronostics";
import { MessageInput } from "@/components/arena/MessageInput";
import { RaceSituationEditor, type RaceSituation } from "@/components/arena/RaceSituationEditor";
import { RaceSituationDisplay } from "@/components/arena/RaceSituationDisplay";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const SuperAdminLiveBroadcastPage = () => {
  const { t } = useTranslation("arena");
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [selectedNewCourseId, setSelectedNewCourseId] = useState("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);

  const { data: managerId } = useCurrentManagerId();
  const { data: liveCourses, isLoading: liveCoursesLoading } = useLiveCourses();
  const activate = useActivateLiveCourse();
  const deactivate = useDeactivateLiveCourse();
  const broadcastMessage = useBroadcastLiveMessage();
  const { data: startlistRiders = [] } = useStartlistRiders(activeCourseId);

  // Selected course info
  const selectedCourse = liveCourses?.find((lc) => lc.course_id === activeCourseId);
  const isMultiStage = selectedCourse?.courses?.type_course === "stage_race" ||
    (selectedCourse?.courses?.date_debut && selectedCourse?.courses?.date_fin &&
     selectedCourse.courses.date_debut !== selectedCourse.courses.date_fin);

  // Reset etape when course changes
  useEffect(() => {
    setSelectedEtape(isMultiStage ? 1 : null);
  }, [activeCourseId, isMultiStage]);

  // Upcoming courses for the "add" selector
  const { data: upcomingCourses } = useQuery({
    queryKey: ["admin-upcoming-courses-live"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, categorie, date_debut, date_fin, type_course")
        .or(`date_fin.gte.${today},date_debut.gte.${today}`)
        .order("date_debut", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Broadcast history: fetch messages from any one league for the active course
  const { data: broadcastHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["admin-broadcast-history", activeCourseId],
    queryFn: async () => {
      if (!activeCourseId) return [];
      const { data, error } = await supabase
        .from("arena_messages")
        .select("id, content, created_at, metadata, author_manager_id")
        .eq("message_type", "admin_broadcast")
        .eq("course_id", activeCourseId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      // Deduplicate by source_message_id or content+time (take unique messages)
      const seen = new Set<string>();
      return (data || []).filter((m) => {
        const key = `${m.content}|${m.created_at}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    enabled: !!activeCourseId,
  });

  const handleActivate = async () => {
    if (!selectedNewCourseId || !managerId) return;
    try {
      await activate.mutateAsync({ courseId: selectedNewCourseId, managerId });
      toast.success("Course activée");
      setSelectedNewCourseId("");
    } catch {
      toast.error("Erreur lors de l'activation");
    }
  };

  const handleDeactivate = async (courseId: string) => {
    try {
      await deactivate.mutateAsync(courseId);
      if (activeCourseId === courseId) setActiveCourseId(null);
      toast.success("Course désactivée");
    } catch {
      toast.error("Erreur lors de la désactivation");
    }
  };

  const handleSend = useCallback(
    (content: string, metadata?: any) => {
      if (!managerId || !activeCourseId) return;
      const enrichedMetadata = {
        ...metadata,
        ...(selectedEtape != null ? { etape_numero: selectedEtape } : {}),
      };
      broadcastMessage.mutate(
        { content, courseId: activeCourseId, managerId, metadata: enrichedMetadata },
        {
          onSuccess: (data) => {
            toast.success(`Message diffusé dans ${data.leagues_count} ligues`);
          },
          onError: (error: any) => {
            toast.error(error.message || "Erreur lors de l'envoi");
          },
        }
      );
    },
    [managerId, activeCourseId, broadcastMessage, selectedEtape]
  );

  const availableCourses = upcomingCourses?.filter(
    (c) => !liveCourses?.some((lc) => lc.course_id === c.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Live Broadcast</h2>
        <p className="text-sm text-muted-foreground">
          Diffusez des messages en direct dans toutes les ligues
        </p>
      </div>

      {/* Section 1: Manage live courses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Courses en direct</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current live courses */}
          {liveCoursesLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Chargement...</span>
            </div>
          ) : liveCourses && liveCourses.length > 0 ? (
            <div className="space-y-2">
              {liveCourses.map((lc) => (
                <div
                  key={lc.course_id}
                  className={cn(
                    "flex items-center justify-between gap-2 p-3 border rounded-lg transition-colors cursor-pointer",
                    activeCourseId === lc.course_id
                      ? "bg-primary/10 border-primary/30"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() =>
                    setActiveCourseId(
                      activeCourseId === lc.course_id ? null : lc.course_id
                    )
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Radio
                      className={cn(
                        "h-4 w-4 shrink-0",
                        activeCourseId === lc.course_id
                          ? "text-primary animate-pulse"
                          : "text-muted-foreground"
                      )}
                    />
                    <span className="text-sm font-medium truncate">
                      {lc.courses?.nom || lc.course_id}
                    </span>
                    {lc.courses?.categorie && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {lc.courses.categorie}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeactivate(lc.course_id);
                    }}
                    disabled={deactivate.isPending}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Aucune course en direct
            </p>
          )}

          {/* Add new course */}
          <div className="flex gap-2">
            <Select value={selectedNewCourseId} onValueChange={setSelectedNewCourseId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Ajouter une course..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableCourses?.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.nom} {course.categorie ? `(${course.categorie})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={!selectedNewCourseId || activate.isPending || !managerId}
            >
              {activate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Broadcast composer */}
      {activeCourseId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Composer un message</CardTitle>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                <Radio className="h-3 w-3 text-primary animate-pulse" />
                <span className="text-[11px] font-medium text-primary">
                  Broadcast global
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <MessageInput
                onSend={handleSend}
                managers={[]}
                riders={startlistRiders}
                disabled={broadcastMessage.isPending}
                readOnly={false}
              />
            </div>
            {startlistRiders.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                💡 Tapez <code className="bg-muted px-1 rounded">#</code> pour mentionner un coureur de la startlist
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 3: Race Situation */}
      {activeCourseId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Situation de course</CardTitle>
          </CardHeader>
          <CardContent>
            <RaceSituationEditor
              onBroadcast={(situation: RaceSituation) => {
                const content = `🏁 Situation à ${situation.kmRemaining} km de l'arrivée`;
                handleSend(content, { race_situation: situation });
              }}
              disabled={broadcastMessage.isPending || !managerId}
              startlistRiders={startlistRiders}
            />
          </CardContent>
        </Card>
      )}

      {/* Section 4: Broadcast history */}
      {activeCourseId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historique des messages</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : broadcastHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun message diffusé pour cette course</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {broadcastHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border"
                  >
                    <Radio className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                      {(msg.metadata as any)?.race_situation && (
                        <div className="mt-2">
                          <RaceSituationDisplay
                            groups={(msg.metadata as any).race_situation.groups}
                            kmRemaining={(msg.metadata as any).race_situation.kmRemaining}
                          />
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {format(new Date(msg.created_at), "d MMM HH:mm", {
                          locale: fr,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

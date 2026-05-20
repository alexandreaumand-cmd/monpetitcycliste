import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Radio, Loader2 } from "lucide-react";
import {
  DEFAULT_SCHEDULE,
  describeSchedule,
  getActiveInterval,
  type ScrapeWindow,
} from "@/components/arena/ScrapeScheduleEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  useLiveCourses,
  useActivateLiveCourse,
  useDeactivateLiveCourse,
  useUpdateLiveCourseStage,
} from "@/components/arena/LiveCourseSelector";
import { useBroadcastLiveMessage } from "@/hooks/useArenaMessages";
import {
  useCurrentManagerId,
  useStartlistRiders,
} from "@/hooks/useArenaPronostics";
import {
  RaceSituationEditor,
  type RaceSituation,
} from "@/components/arena/RaceSituationEditor";
import { RaceTimeline, type TimelineEvent } from "@/components/arena/RaceTimeline";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { LiveImportBar } from "@/components/admin/live/LiveImportBar";
import { ActiveCourseHeader } from "@/components/admin/live/ActiveCourseHeader";

export const SuperAdminLiveBroadcastPage = () => {
  const isMobile = useIsMobile();
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [selectedNewCourseId, setSelectedNewCourseId] = useState("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const isScrapingRef = useRef(false);
  const [autoScrapeEnabled, setAutoScrapeEnabled] = useState(false);
  const [schedule, setSchedule] = useState<ScrapeWindow[]>(DEFAULT_SCHEDULE);
  const [lastAutoScrapeAt, setLastAutoScrapeAt] = useState<Date | null>(null);
  const [nextScrapeAt, setNextScrapeAt] = useState<Date | null>(null);

  const sentEventsRef = useRef<Set<string>>(new Set());
  const lastSituationRef = useRef<string>("");
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [importedSituation, setImportedSituation] = useState<RaceSituation | null>(
    null
  );
  const [matchedRiders, setMatchedRiders] = useState<
    Record<string, { manager_name: string; rider_nom: string }>
  >({});
  const [scrapeStats, setScrapeStats] = useState<{
    total: number;
    matched: number;
    unmatched: string[];
  } | null>(null);

  const { data: managerId } = useCurrentManagerId();
  const { data: liveCourses, isLoading: liveCoursesLoading } = useLiveCourses();
  const activate = useActivateLiveCourse();
  const deactivate = useDeactivateLiveCourse();
  const updateStage = useUpdateLiveCourseStage();
  const broadcastMessage = useBroadcastLiveMessage();
  const { data: startlistRiders = [] } = useStartlistRiders(activeCourseId);

  const selectedCourse = liveCourses?.find(
    (lc) => lc.course_id === activeCourseId
  );
  const isMultiStage =
    selectedCourse?.courses?.type_course === "stage_race" ||
    (selectedCourse?.courses?.date_debut &&
      selectedCourse?.courses?.date_fin &&
      selectedCourse.courses.date_debut !== selectedCourse.courses.date_fin);

  useEffect(() => {
    if (!activeCourseId) {
      setSelectedEtape(null);
      return;
    }
    if (isMultiStage) {
      setSelectedEtape(selectedCourse?.current_etape ?? 1);
    } else {
      setSelectedEtape(null);
    }
  }, [activeCourseId, isMultiStage, selectedCourse?.current_etape]);

  const handleStageChange = useCallback(
    (etape: number) => {
      setSelectedEtape(etape);
      if (activeCourseId && isMultiStage) {
        updateStage.mutate({ courseId: activeCourseId, etape });
      }
    },
    [activeCourseId, isMultiStage, updateStage]
  );

  // Hydrate URL + schedule + auto-enabled from DB when course changes
  useEffect(() => {
    if (!activeCourseId) return;
    sentEventsRef.current = new Set();
    lastSituationRef.current = "";
    supabase
      .from("arena_live_courses")
      .select(
        "live_scrape_url, scrape_schedule, auto_scrape_enabled, last_auto_scrape_at, next_auto_scrape_at"
      )
      .eq("course_id", activeCourseId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as any;
        if (d.live_scrape_url) setScrapeUrl(d.live_scrape_url);
        if (Array.isArray(d.scrape_schedule) && d.scrape_schedule.length > 0) {
          setSchedule(d.scrape_schedule as ScrapeWindow[]);
        } else {
          setSchedule(DEFAULT_SCHEDULE);
        }
        setAutoScrapeEnabled(!!d.auto_scrape_enabled);
        setLastAutoScrapeAt(d.last_auto_scrape_at ? new Date(d.last_auto_scrape_at) : null);
        setNextScrapeAt(d.next_auto_scrape_at ? new Date(d.next_auto_scrape_at) : null);
      });
  }, [activeCourseId]);

  // Persist schedule changes to DB (debounced)
  useEffect(() => {
    if (!activeCourseId) return;
    const t = setTimeout(() => {
      supabase
        .from("arena_live_courses")
        .update({ scrape_schedule: schedule } as any)
        .eq("course_id", activeCourseId)
        .eq("is_active", true)
        .then(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [activeCourseId, schedule]);

  // Poll DB for cron-updated timestamps while auto is ON
  useEffect(() => {
    if (!activeCourseId || !autoScrapeEnabled) return;
    const fetchTs = async () => {
      const { data } = await supabase
        .from("arena_live_courses")
        .select("last_auto_scrape_at, next_auto_scrape_at")
        .eq("course_id", activeCourseId)
        .eq("is_active", true)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setLastAutoScrapeAt(d.last_auto_scrape_at ? new Date(d.last_auto_scrape_at) : null);
        setNextScrapeAt(d.next_auto_scrape_at ? new Date(d.next_auto_scrape_at) : null);
      }
    };
    fetchTs();
    const id = setInterval(fetchTs, 10_000);
    return () => clearInterval(id);
  }, [activeCourseId, autoScrapeEnabled]);


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

  const handleScrape = async (isAuto = false) => {
    if (!scrapeUrl || !activeCourseId) return;
    if (isScrapingRef.current) return;
    setIsScraping(true);
    isScrapingRef.current = true;

    if (!isAuto) {
      supabase
        .from("arena_live_courses")
        .update({ live_scrape_url: scrapeUrl } as any)
        .eq("course_id", activeCourseId)
        .eq("is_active", true)
        .then(() => {});
    }
    try {
      const { data, error } = await supabase.functions.invoke("scrape-live-race", {
        body: {
          url: scrapeUrl,
          course_id: activeCourseId,
          is_stage_race: !!isMultiStage,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const events = data.timeline || [];
      setTimelineEvents(events);

      const matched = data.matched_riders || {};
      if (data.situation?.groups?.length > 0) {
        const nameToId: Record<string, string> = {};
        for (const [coueurId, info] of Object.entries(matched)) {
          const m = info as any;
          if (m.scraped_name) nameToId[m.scraped_name.toLowerCase()] = coueurId;
          if (m.rider_nom) nameToId[m.rider_nom.toLowerCase()] = coueurId;
        }

        const enrichedGroups = data.situation.groups.map((g: any) => ({
          ...g,
          riderIds: (g.riders || []).map(
            (name: string) => nameToId[name.toLowerCase()] || ""
          ),
        }));
        setImportedSituation({
          groups: enrichedGroups,
          kmRemaining: data.situation.kmRemaining || 0,
        });
      }

      setMatchedRiders(data.matched_riders || {});

      setScrapeStats({
        total: data.total_scraped || 0,
        matched: data.total_matched || 0,
        unmatched: data.unmatched_names || [],
      });

      const cleanText = (text: string): string => {
        return text
          .replace(/;/g, ", ")
          .replace(/\s{2,}/g, " ")
          .replace(/,\s*,/g, ",")
          .trim();
      };

      const eventKey = (evt: TimelineEvent) =>
        `${evt.time}|${(evt.title || "").substring(0, 30)}|${evt.text.substring(0, 50)}`;
      if (events.length > 0 && managerId) {
        const reversedEvents = [...events].reverse();
        const newEvents = reversedEvents.filter(
          (evt) => !sentEventsRef.current.has(eventKey(evt))
        );
        if (newEvents.length > 0) {
          let sent = 0;
          for (const evt of newEvents) {
            const typeEmoji =
              evt.type === "crash"
                ? "💥"
                : evt.type === "breakaway"
                ? "🚴"
                : evt.type === "gap"
                ? "⏱️"
                : evt.type === "dropped"
                ? "📉"
                : evt.type === "intermediate"
                ? "🏁"
                : evt.type === "abandon"
                ? "🚑"
                : "📢";
            const titlePart = evt.title ? `**${cleanText(evt.title)}**\n` : "";
            const content = `${typeEmoji} ${evt.time} — ${titlePart}${cleanText(evt.text)}`;
            try {
              await new Promise<void>((resolve, reject) => {
                broadcastMessage.mutate(
                  {
                    content,
                    courseId: activeCourseId,
                    managerId,
                    metadata:
                      selectedEtape != null
                        ? { etape_numero: selectedEtape }
                        : {},
                  },
                  { onSuccess: () => resolve(), onError: (e) => reject(e) }
                );
              });
              sent++;
              sentEventsRef.current.add(eventKey(evt));
            } catch (e) {
              console.error("Failed to broadcast event:", e);
            }
          }
          toast.success(`${sent} nouveaux événements diffusés`);
        }
      } else if (events.length === 0) {
        toast.success(
          `Import: ${data.total_matched}/${data.total_scraped} coureurs matchés`
        );
      }

      if (data.situation?.groups?.length > 0 && managerId) {
        const enrichedSitGroups = data.situation.groups.map((g: any) => ({
          ...g,
          riderIds: g.riderIds || [],
        }));
        const situation = {
          groups: enrichedSitGroups,
          kmRemaining: data.situation.kmRemaining || 0,
        };
        const sitKey =
          JSON.stringify(
            situation.groups.map(
              (g: any) => g.name + g.gap + (g.riders?.length || 0)
            )
          ) + situation.kmRemaining;

        if (sitKey !== lastSituationRef.current) {
          const riderMentions: { rider_nom: string; coureur_id: string }[] = [];
          for (const g of situation.groups) {
            (g.riders || []).forEach((name: string, ri: number) => {
              const id = g.riderIds?.[ri];
              if (id) riderMentions.push({ rider_nom: name, coureur_id: id });
            });
          }
          const sitContent = `🏁 Situation à ${situation.kmRemaining} km de l'arrivée`;
          try {
            await new Promise<void>((resolve, reject) => {
              broadcastMessage.mutate(
                {
                  content: sitContent,
                  courseId: activeCourseId,
                  managerId,
                  metadata: {
                    race_situation: situation,
                    rider_mentions: riderMentions,
                    ...(selectedEtape != null
                      ? { etape_numero: selectedEtape }
                      : {}),
                  },
                },
                { onSuccess: () => resolve(), onError: (e) => reject(e) }
              );
            });
            lastSituationRef.current = sitKey;
          } catch (e) {
            console.error("Failed to broadcast situation:", e);
          }
        }
      }
    } catch (err: any) {
      console.error("Scrape error:", err);
      toast.error(err.message || "Erreur lors de l'import");
    } finally {
      setIsScraping(false);
      isScrapingRef.current = false;
      setLastAutoScrapeAt(new Date());
    }
  };

  const availableCourses = upcomingCourses?.filter(
    (c) => !liveCourses?.some((lc) => lc.course_id === c.id)
  );

  const handleToggleAuto = async () => {
    if (!activeCourseId) return;
    const next = !autoScrapeEnabled;
    if (next) {
      if (!scrapeUrl) {
        toast.error("Entrez une URL d'abord");
        return;
      }
      if (!schedule.length) {
        toast.error("Configurez au moins une plage horaire");
        return;
      }
    }
    setAutoScrapeEnabled(next);
    const { error } = await supabase
      .from("arena_live_courses")
      .update({
        auto_scrape_enabled: next,
        live_scrape_url: scrapeUrl,
        scrape_schedule: schedule,
      } as any)
      .eq("course_id", activeCourseId)
      .eq("is_active", true);
    if (error) {
      setAutoScrapeEnabled(!next);
      toast.error("Erreur : " + error.message);
      return;
    }
    if (next) {
      toast.success(`Auto-import serveur activé — ${describeSchedule(schedule)}`);
    } else {
      toast.success("Auto-import désactivé");
      setNextScrapeAt(null);
    }
  };

  const situationPanel = (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          Situation de course
        </CardTitle>
      </CardHeader>
      <CardContent>
        {importedSituation ? (
          <RaceSituationEditor
            onBroadcast={(situation: RaceSituation) => {
              const riderMentions: { rider_nom: string; coureur_id: string }[] =
                [];
              for (const g of situation.groups) {
                g.riders.forEach((name, ri) => {
                  const id = g.riderIds?.[ri];
                  if (id)
                    riderMentions.push({ rider_nom: name, coureur_id: id });
                });
              }
              const content = `🏁 Situation à ${situation.kmRemaining} km de l'arrivée`;
              handleSend(content, {
                race_situation: situation,
                rider_mentions: riderMentions,
              });
            }}
            disabled={broadcastMessage.isPending || !managerId}
            startlistRiders={startlistRiders}
            importedSituation={importedSituation}
          />
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              Importez une URL pour afficher la situation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const timelinePanel = (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {timelineEvents.length > 0 ? (
          <RaceTimeline
            events={timelineEvents}
            onBroadcast={(text) => handleSend(text)}
            disabled={broadcastMessage.isPending || !managerId}
            matchedRiders={matchedRiders}
          />
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">Aucun événement importé.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Live Broadcast</h2>
        <p className="text-sm text-muted-foreground">
          Importez une URL, visualisez la situation, diffusez en direct.
        </p>
      </div>

      <ActiveCourseHeader
        liveCourses={liveCourses}
        liveCoursesLoading={liveCoursesLoading}
        activeCourseId={activeCourseId}
        onSelectCourse={(id) =>
          setActiveCourseId(activeCourseId === id ? null : id)
        }
        availableCourses={availableCourses}
        selectedNewCourseId={selectedNewCourseId}
        onSelectedNewCourseIdChange={setSelectedNewCourseId}
        onActivate={handleActivate}
        activatePending={activate.isPending}
        canActivate={!!managerId}
        onDeactivate={handleDeactivate}
        deactivatePending={deactivate.isPending}
        isMultiStage={!!isMultiStage}
        selectedEtape={selectedEtape}
        onStageChange={handleStageChange}
      />

      {activeCourseId && (
        <>
          <LiveImportBar
            scrapeUrl={scrapeUrl}
            onScrapeUrlChange={setScrapeUrl}
            onImport={() => handleScrape()}
            isScraping={isScraping}
            autoScrapeEnabled={autoScrapeEnabled}
            onToggleAuto={handleToggleAuto}
            schedule={schedule}
            onScheduleChange={setSchedule}
            lastAutoScrapeAt={lastAutoScrapeAt}
            nextScrapeAt={nextScrapeAt}
            scrapeStats={scrapeStats}
            sticky={isMobile}
          />

          {isMobile ? (
            <Tabs defaultValue="situation" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="situation">Situation</TabsTrigger>
                <TabsTrigger value="timeline">
                  Timeline
                  {timelineEvents.length > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                      {timelineEvents.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="situation" className="mt-3">
                {situationPanel}
              </TabsContent>
              <TabsContent value="timeline" className="mt-3">
                {timelinePanel}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
              {situationPanel}
              {timelinePanel}
            </div>
          )}

          {isScraping && (
            <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-md bg-background border shadow-lg text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Import en cours…
            </div>
          )}
        </>
      )}
    </div>
  );
};

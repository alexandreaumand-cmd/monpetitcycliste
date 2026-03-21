import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, Radio, Plus, Archive, Send, Link2, RefreshCw, Timer, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { RaceTimeline, type TimelineEvent } from "@/components/arena/RaceTimeline";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const SuperAdminLiveBroadcastPage = () => {
  const { t } = useTranslation("arena");
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [selectedNewCourseId, setSelectedNewCourseId] = useState("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [autoScrapeEnabled, setAutoScrapeEnabled] = useState(false);
  const autoScrapeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastAutoScrapeAt, setLastAutoScrapeAt] = useState<Date | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [importedSituation, setImportedSituation] = useState<RaceSituation | null>(null);
  const [matchedRiders, setMatchedRiders] = useState<Record<string, { manager_name: string; rider_nom: string }>>({});
  const [scrapeStats, setScrapeStats] = useState<{ total: number; matched: number; unmatched: string[] } | null>(null);

  const { data: managerId } = useCurrentManagerId();
  const { data: liveCourses, isLoading: liveCoursesLoading } = useLiveCourses();
  const activate = useActivateLiveCourse();
  const deactivate = useDeactivateLiveCourse();
  const broadcastMessage = useBroadcastLiveMessage();
  const { data: startlistRiders = [] } = useStartlistRiders(activeCourseId);

  const selectedCourse = liveCourses?.find((lc) => lc.course_id === activeCourseId);
  const isMultiStage = selectedCourse?.courses?.type_course === "stage_race" ||
    (selectedCourse?.courses?.date_debut && selectedCourse?.courses?.date_fin &&
     selectedCourse.courses.date_debut !== selectedCourse.courses.date_fin);

  useEffect(() => {
    setSelectedEtape(isMultiStage ? 1 : null);
  }, [activeCourseId, isMultiStage]);

  // Load persisted scrape URL from DB when course changes
  useEffect(() => {
    if (!activeCourseId) return;
    setAutoScrapeEnabled(false);
    supabase
      .from("arena_live_courses")
      .select("live_scrape_url")
      .eq("course_id", activeCourseId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.live_scrape_url) {
          setScrapeUrl(data.live_scrape_url);
        }
      });
  }, [activeCourseId]);

  // Auto-scrape every 60s when enabled
  useEffect(() => {
    if (autoScrapeRef.current) {
      clearInterval(autoScrapeRef.current);
      autoScrapeRef.current = null;
    }
    if (!autoScrapeEnabled || !scrapeUrl || !activeCourseId) return;

    const doAutoScrape = () => {
      if (isScraping) return;
      handleScrape(true);
    };

    autoScrapeRef.current = setInterval(doAutoScrape, 60_000);
    return () => {
      if (autoScrapeRef.current) clearInterval(autoScrapeRef.current);
    };
  }, [autoScrapeEnabled, scrapeUrl, activeCourseId]);

  // Build roster owners map from matched riders
  const rosterOwners = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, info] of Object.entries(matchedRiders)) {
      if (info.manager_name) map[id] = info.manager_name;
    }
    return map;
  }, [matchedRiders]);

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

  const handleScrape = async (isAuto = false) => {
    if (!scrapeUrl || !activeCourseId) return;
    setIsScraping(true);

    // Persist URL to DB
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
        body: { url: scrapeUrl, course_id: activeCourseId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Set timeline events
      const events = data.timeline || [];
      setTimelineEvents(events);

      // Set imported situation — enrich with riderIds from matched_riders
      const matched = data.matched_riders || {};
      if (data.situation?.groups?.length > 0) {
        // Build reverse lookup: scraped name → coureur_id
        const nameToId: Record<string, string> = {};
        for (const [coueurId, info] of Object.entries(matched)) {
          const m = info as any;
          if (m.scraped_name) nameToId[m.scraped_name.toLowerCase()] = coueurId;
          if (m.rider_nom) nameToId[m.rider_nom.toLowerCase()] = coueurId;
        }

        const enrichedGroups = data.situation.groups.map((g: any) => ({
          ...g,
          riderIds: (g.riders || []).map((name: string) => nameToId[name.toLowerCase()] || ""),
        }));
        setImportedSituation({ groups: enrichedGroups, kmRemaining: data.situation.kmRemaining || 0 });
      }

      // Set matched riders
      setMatchedRiders(data.matched_riders || {});

      // Stats
      setScrapeStats({
        total: data.total_scraped || 0,
        matched: data.total_matched || 0,
        unmatched: data.unmatched_names || [],
      });

      // Auto-broadcast all timeline events (reversed so oldest first)
      // Build a lookup: various name forms → manager name
      // Normalize accents for matching: é→e, č→c, etc.
      const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const riderToManager: Record<string, string> = {};
      for (const [, info] of Object.entries(matched)) {
        const m = info as any;
        if (m.manager_name) {
          const addVariants = (name: string) => {
            const lc = name.toLowerCase();
            riderToManager[lc] = m.manager_name;
            // Also add accent-stripped version
            const stripped = stripAccents(lc);
            if (stripped !== lc) riderToManager[stripped] = m.manager_name;
          };
          if (m.scraped_name) addVariants(m.scraped_name);
          if (m.rider_nom) {
            addVariants(m.rider_nom);
            const parts = m.rider_nom.split(/\s+/);
            if (parts.length >= 2) {
              // Reversed order: "Tadej Pogacar" from "POGACAR Tadej"
              addVariants([...parts].reverse().join(" "));
              addVariants(parts.join(" "));
              // Last name only
              const lastName = parts[0].toLowerCase();
              if (lastName.length >= 4) {
                riderToManager[lastName] = m.manager_name;
                const strippedLast = stripAccents(lastName);
                if (strippedLast !== lastName) riderToManager[strippedLast] = m.manager_name;
              }
              // Initial + lastname variants: "J. Alaphilippe", "T. Pogacar"
              // rider_nom is typically "LASTNAME Firstname"
              const lastNamePart = parts.slice(0, -1).join(" ");
              const firstName = parts[parts.length - 1];
              if (firstName) {
                const initial = firstName[0];
                const variant = `${initial}. ${lastNamePart}`.toLowerCase();
                riderToManager[variant] = m.manager_name;
                riderToManager[stripAccents(variant)] = m.manager_name;
                // Also reversed: "FIRSTNAME LASTNAME" → initial from first
                const reversedParts = [...parts].reverse();
                const revInitial = reversedParts[0][0];
                const revLast = reversedParts.slice(1).join(" ");
                const revVariant = `${revInitial}. ${revLast}`.toLowerCase();
                riderToManager[revVariant] = m.manager_name;
                riderToManager[stripAccents(revVariant)] = m.manager_name;
              }
            }
          }
        }
      }

      // Replace rider names in text with "rider (manager)" and clean formatting
      // Sort entries by name length DESC so longer names match first (avoids partial matches)
      const sortedEntries = Object.entries(riderToManager)
        .filter(([name]) => name.length >= 4)
        .sort((a, b) => b[0].length - a[0].length);

      const enrichText = (text: string): string => {
        let result = text
          .replace(/;/g, ', ')
          .replace(/\s{2,}/g, ' ')
          .replace(/,\s*,/g, ',')
          .trim();
        // Also try matching on accent-stripped version of the text
        const resultStripped = stripAccents(result.toLowerCase());
        const alreadyAnnotated = new Set<string>();
        for (const [name, mgr] of sortedEntries) {
          if (alreadyAnnotated.has(mgr + name)) continue;
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Try direct match first
          const regex = new RegExp(`(?<!\\()\\b${escaped}\\b(?!\\s*\\()`, 'gi');
          if (regex.test(result)) {
            result = result.replace(regex, (match) => `${match} (${mgr})`);
            alreadyAnnotated.add(mgr + name);
          } else {
            // Try accent-stripped match: find position in stripped text, replace in original
            const strippedEscaped = stripAccents(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const strippedRegex = new RegExp(`(?<!\\()\\b${strippedEscaped}\\b(?!\\s*\\()`, 'gi');
            const strippedMatch = strippedRegex.exec(resultStripped);
            if (strippedMatch) {
              const idx = strippedMatch.index;
              const len = strippedMatch[0].length;
              const originalSlice = result.substring(idx, idx + len);
              result = result.substring(0, idx + len) + ` (${mgr})` + result.substring(idx + len);
              alreadyAnnotated.add(mgr + name);
            }
          }
        }
        return result;
      };

      if (events.length > 0 && managerId) {
        const reversedEvents = [...events].reverse();
        let sent = 0;
        for (const evt of reversedEvents) {
          const typeEmoji = evt.type === "crash" ? "💥" : evt.type === "breakaway" ? "🚴" : evt.type === "gap" ? "⏱️" : evt.type === "dropped" ? "📉" : evt.type === "intermediate" ? "🏁" : evt.type === "abandon" ? "🚑" : "📢";
          const content = `${typeEmoji} **${evt.time}** — ${enrichText(evt.text)}`;
          try {
            await new Promise<void>((resolve, reject) => {
              broadcastMessage.mutate(
                { content, courseId: activeCourseId, managerId, metadata: selectedEtape != null ? { etape_numero: selectedEtape } : {} },
                { onSuccess: () => resolve(), onError: (e) => reject(e) }
              );
            });
            sent++;
          } catch (e) {
            console.error("Failed to broadcast event:", e);
          }
        }
        toast.success(`${sent}/${events.length} événements diffusés automatiquement`);
      } else {
        toast.success(`Import: ${data.total_matched}/${data.total_scraped} coureurs matchés`);
      }

      // Auto-broadcast situation de course if available
      if (data.situation?.groups?.length > 0 && managerId) {
        const sitGroups = data.situation.groups.map((g: any) => ({
          ...g,
          riderIds: (g.riderIds || g.riders || []).map((name: string) => {
            const lc = name.toLowerCase();
            // Try to find coureur_id from matched riders
            for (const [cId, info] of Object.entries(matched)) {
              const m = info as any;
              if (m.scraped_name?.toLowerCase() === lc || m.rider_nom?.toLowerCase() === lc) return cId;
            }
            return "";
          }),
        }));
        const situation = { groups: sitGroups, kmRemaining: data.situation.kmRemaining || 0 };
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
              { content: sitContent, courseId: activeCourseId, managerId, metadata: { race_situation: situation, rider_mentions: riderMentions, ...(selectedEtape != null ? { etape_numero: selectedEtape } : {}) } },
              { onSuccess: () => resolve(), onError: (e) => reject(e) }
            );
          });
          console.log("[auto-scrape] Situation de course diffusée");
        } catch (e) {
          console.error("Failed to broadcast situation:", e);
        }
      }
    } catch (err: any) {
      console.error("Scrape error:", err);
      toast.error(err.message || "Erreur lors de l'import");
    } finally {
      setIsScraping(false);
      setLastAutoScrapeAt(new Date());
    }
  };

  const availableCourses = upcomingCourses?.filter(
    (c) => !liveCourses?.some((lc) => lc.course_id === c.id)
  );

  const filteredHistory = useMemo(() => {
    if (!isMultiStage || selectedEtape == null) return broadcastHistory;
    return broadcastHistory.filter(
      (msg) => (msg.metadata as any)?.etape_numero === selectedEtape
    );
  }, [broadcastHistory, isMultiStage, selectedEtape]);

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
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Archiver "${lc.courses?.nom || lc.course_id}" ?`)) {
                        handleDeactivate(lc.course_id);
                      }
                    }}
                    disabled={deactivate.isPending}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archiver
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Aucune course en direct
            </p>
          )}

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

      {/* Active course content: 2-column layout */}
      {activeCourseId && (
        <>
          {/* URL Import bar */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  placeholder="URL FirstCycling ou PCS (ex: firstcycling.com/race.php?r=13&y=2025&e=01)"
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleScrape()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleScrape()}
                  disabled={isScraping || !scrapeUrl}
                  className="h-8 gap-1.5 shrink-0"
                >
                  {isScraping ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Importer
                </Button>
                <Button
                  size="sm"
                  variant={autoScrapeEnabled ? "default" : "outline"}
                  onClick={() => {
                    if (!scrapeUrl) {
                      toast.error("Entrez une URL d'abord");
                      return;
                    }
                    setAutoScrapeEnabled(!autoScrapeEnabled);
                    if (!autoScrapeEnabled) {
                      toast.success("Auto-refresh activé (toutes les 60s)");
                    }
                  }}
                  className="h-8 gap-1.5 shrink-0"
                >
                  {autoScrapeEnabled ? (
                    <Timer className="h-3.5 w-3.5 animate-pulse" />
                  ) : (
                    <TimerOff className="h-3.5 w-3.5" />
                  )}
                  {autoScrapeEnabled ? "Auto ON" : "Auto"}
                </Button>
              </div>
              {(scrapeStats || autoScrapeEnabled) && (
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {scrapeStats && (
                    <span>{scrapeStats.matched}/{scrapeStats.total} coureurs matchés</span>
                  )}
                  {scrapeStats && scrapeStats.unmatched.length > 0 && (
                    <span className="text-destructive">
                      Non matchés : {scrapeStats.unmatched.slice(0, 3).join(", ")}
                      {scrapeStats.unmatched.length > 3 && ` +${scrapeStats.unmatched.length - 3}`}
                    </span>
                  )}
                  {autoScrapeEnabled && lastAutoScrapeAt && (
                    <span className="ml-auto text-primary">
                      ⏱ Dernier refresh : {format(lastAutoScrapeAt, "HH:mm:ss")}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left column: Composer + Timeline + History */}
            <div className="space-y-4">
              {/* Composer */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">Composer</CardTitle>
                    {isMultiStage && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Étape</span>
                        <input
                          type="number"
                          min={1}
                          max={21}
                          value={selectedEtape ?? 1}
                          onChange={(e) => setSelectedEtape(parseInt(e.target.value) || 1)}
                          className="w-16 h-8 rounded-md border border-input bg-background px-2 text-sm text-center"
                        />
                      </div>
                    )}
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
                      💡 Tapez <code className="bg-muted px-1 rounded">#</code> pour mentionner un coureur
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              {timelineEvents.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RaceTimeline
                      events={timelineEvents}
                      onBroadcast={(text) => handleSend(text)}
                      disabled={broadcastMessage.isPending || !managerId}
                      matchedRiders={matchedRiders}
                    />
                  </CardContent>
                </Card>
              )}

              {/* History */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Historique
                    {isMultiStage && selectedEtape && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        — Étape {selectedEtape}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredHistory.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucun message diffusé</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {filteredHistory.map((msg) => (
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
                                  rosterOwners={rosterOwners}
                                />
                              </div>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {format(new Date(msg.created_at), "d MMM HH:mm", { locale: fr })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column: Situation de course */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Situation de course</CardTitle>
                </CardHeader>
                <CardContent>
                  <RaceSituationEditor
                    onBroadcast={(situation: RaceSituation) => {
                      const riderMentions: { rider_nom: string; coureur_id: string }[] = [];
                      for (const g of situation.groups) {
                        g.riders.forEach((name, ri) => {
                          const id = g.riderIds?.[ri];
                          if (id) riderMentions.push({ rider_nom: name, coureur_id: id });
                        });
                      }
                      const content = `🏁 Situation à ${situation.kmRemaining} km de l'arrivée`;
                      handleSend(content, { race_situation: situation, rider_mentions: riderMentions });
                    }}
                    disabled={broadcastMessage.isPending || !managerId}
                    startlistRiders={startlistRiders}
                    importedSituation={importedSituation}
                    rosterOwners={rosterOwners}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

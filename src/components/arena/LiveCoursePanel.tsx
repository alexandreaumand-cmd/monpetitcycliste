import { useState, useRef, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Radio, MapPin, Route, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LiveStageBadge } from "./LiveStageBadge";
import { useLiveStageStatus } from "@/hooks/useLiveStageStatus";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageBubble } from "./MessageBubble";
import { RaceSituationDisplay } from "./RaceSituationDisplay";
import {
  useArenaMessages,
  useMessageReactions,
  useLeagueRosterOwners,
} from "@/hooks/useArenaMessages";
import { useLiveCourses } from "./LiveCourseSelector";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const formatRelativeFr = (iso: string, _tick: number) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60) return `il y a ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `il y a ${h} h ${min % 60} min`;
};

interface LiveCoursePanelProps {
  leagueId: string;
  courseId: string;
  channelId: string;
  managerId: string;
  courseName?: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  compact?: boolean;
  showProfile?: boolean;
}

export const LiveCoursePanel = ({
  leagueId,
  courseId,
  channelId,
  managerId,
  courseName,
  onToggleReaction,
  compact = false,
  showProfile = true,
}: LiveCoursePanelProps) => {
  const { t } = useTranslation("arena");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: rosterOwners = {} } = useLeagueRosterOwners(leagueId, courseId);
  const { data: liveCourses } = useLiveCourses();
  const currentEtape = liveCourses?.find((lc) => lc.course_id === courseId)?.current_etape ?? null;
  const stageStatus = useLiveStageStatus(courseId, currentEtape);

  // Ticks every 15s so the "mise à jour il y a …" label stays fresh
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);



  const {
    data: messagesData,
    isLoading: messagesLoading,
  } = useArenaMessages(channelId, leagueId, courseId);

  const { data: routeImages } = useQuery({
    queryKey: ["course-route-images", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_route_images")
        .select("etape_numero, image_url, label")
        .eq("course_id", courseId);
      return data ?? [];
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });

  const activeEtape = selectedEtape ?? stageStatus.etape;
  const stageImage = useMemo(() => {
    if (!routeImages || routeImages.length === 0) return null;
    if (activeEtape != null) {
      const match = routeImages.find((img) => img.etape_numero === activeEtape);
      if (match) return match;
    }
    const overview = routeImages.find((img) => img.etape_numero == null);
    return overview ?? null;
  }, [routeImages, activeEtape]);

  const allMessages = useMemo(() => {
    if (!messagesData?.pages) return [];
    return messagesData.pages.flatMap((p) => p.messages);
  }, [messagesData]);

  const availableStages = useMemo(() => {
    const stages = new Set<number>();
    allMessages.forEach((msg) => {
      const etape = (msg.metadata as any)?.etape_numero;
      if (etape != null) stages.add(etape);
    });
    if (stageStatus.etape != null) stages.add(stageStatus.etape);
    return Array.from(stages).sort((a, b) => a - b);
  }, [allMessages, stageStatus.etape]);

  // Auto-select the stage currently being broadcast live (admin's choice)
  useEffect(() => {
    setSelectedEtape(stageStatus.etape);
  }, [courseId, stageStatus.etape]);

  const filteredMessages = useMemo(() => {
    if (selectedEtape == null) return allMessages;
    return allMessages.filter(
      (msg) => (msg.metadata as any)?.etape_numero === selectedEtape
    );
  }, [allMessages, selectedEtape]);

  // Live situation stored on arena_live_courses (refreshed by the auto-scraper)
  const { data: liveSituationRow, refetch: refetchLiveSituation } = useQuery({
    queryKey: ["arena-live-situation", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("arena_live_courses")
        .select("current_race_situation, situation_updated_at")
        .eq("course_id", courseId)
        .eq("is_active", true)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!courseId,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 5 * 1000,
  });

  // Mobile : les timers sont gelés en arrière-plan → rattrapage dès le retour
  useEffect(() => {
    if (!courseId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refetchLiveSituation();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [courseId, refetchLiveSituation]);


  const messageSituation = useMemo(() => {
    for (const msg of filteredMessages) {
      const sit = (msg.metadata as any)?.race_situation;
      const km = Number(sit?.kmRemaining);
      if ((sit?.groups?.length ?? 0) > 0 || Number.isFinite(km)) return sit;
    }
    return null;
  }, [filteredMessages]);

  const liveSituation = (liveSituationRow?.current_race_situation as any) ?? null;
  const liveSituationMatchesStage =
    liveSituation &&
    (selectedEtape == null ||
      liveSituation.etape_numero == null ||
      liveSituation.etape_numero === selectedEtape);

  const latestSituation = liveSituationMatchesStage ? liveSituation : messageSituation;
  const situationUpdatedAt = liveSituationMatchesStage
    ? (liveSituationRow?.situation_updated_at as string | null)
    : null;

  /** Kilométrage restant du dernier évènement de la timeline (parsé du texte « — à 106 km »). */
  const latestEventKm = useMemo(() => {
    for (const msg of filteredMessages) {
      const m = /à\s+([\d]+(?:[.,]\d+)?)\s*km/.exec(String(msg.content ?? ""));
      if (m) return Number(m[1].replace(",", "."));
    }
    return null;
  }, [filteredMessages]);

  const situationBehindTimeline =
    latestEventKm != null &&
    Number.isFinite(Number(latestSituation?.kmRemaining)) &&
    Number(latestSituation?.kmRemaining) > latestEventKm + 0.5;




  const messageIds = useMemo(() => filteredMessages.map((m) => m.id), [filteredMessages]);
  const { data: reactionsMap = {} } = useMessageReactions(messageIds, managerId);

  const stageFilter = availableStages.length > 1 && (
    <div className="flex items-center gap-1.5 overflow-x-auto ml-auto">
      <span className="text-xs font-medium text-muted-foreground shrink-0">Étape :</span>
      <Badge
        variant={selectedEtape == null ? "default" : "outline"}
        className={cn(
          "cursor-pointer min-h-[24px] px-2 py-0.5 text-xs whitespace-nowrap",
          "active:scale-95 transition-all"
        )}
        onClick={() => setSelectedEtape(null)}
      >
        Toutes
      </Badge>
      {availableStages.map((stage) => {
        const isLive = stage === stageStatus.etape;
        const isSelected = selectedEtape === stage;
        return (
          <Badge
            key={stage}
            variant={isSelected ? "default" : "outline"}
            className={cn(
              "cursor-pointer min-h-[24px] px-2 py-0.5 text-xs whitespace-nowrap gap-1",
              "active:scale-95 transition-all",
              isLive && !isSelected && "border-destructive text-destructive"
            )}
            onClick={() => setSelectedEtape(stage)}
          >
            {isLive && (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full animate-pulse",
                  isSelected ? "bg-primary-foreground" : "bg-destructive"
                )}
              />
            )}
            É{stage}
          </Badge>
        );
      })}
    </div>
  );


  const messagesContent = messagesLoading ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ) : filteredMessages.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <MessageCircle className="h-8 w-8 mb-2 opacity-20" />
      <p className="font-medium text-xs">{t("trashTalk.empty")}</p>
    </div>
  ) : (
    <div className="py-2 space-y-0.5">
      {filteredMessages.map((msg, idx) => {
        const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
        const showAuthor =
          !prevMsg ||
          prevMsg.author_manager_id !== msg.author_manager_id ||
          msg.message_type !== prevMsg.message_type ||
          Math.abs(new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) > 5 * 60 * 1000;

        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            reactions={reactionsMap[msg.id] || []}
            onToggleReaction={(emoji) => onToggleReaction(msg.id, emoji)}
            isOwnMessage={msg.author_manager_id === managerId}
            showAuthor={showAuthor}
            disabled={false}
            rosterOwners={rosterOwners}
          />
        );
      })}
    </div>
  );

  const raceSituationContent = latestSituation ? (
    <RaceSituationDisplay
      groups={latestSituation.groups}
      kmRemaining={latestSituation.kmRemaining}
      rosterOwners={rosterOwners}
    />
  ) : (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <MapPin className="h-6 w-6 mb-2 opacity-20" />
      <p className="text-xs text-center">Aucune situation</p>
    </div>
  );

  const situationWidth = "w-1/2";

  return (
    <div className="flex flex-col flex-1 border rounded-xl overflow-hidden bg-background min-w-0">
      {/* Single header row: course name + live state + stage filter */}
      {(courseName || stageStatus.etape != null || stageFilter) && (
        <div className="px-3 py-1.5 border-b bg-primary/5 flex items-center gap-2 min-w-0">
          {courseName && (
            <span className="text-xs font-bold text-primary truncate shrink">{courseName}</span>
          )}
          <LiveStageBadge etape={stageStatus.etape} state={stageStatus.state} />
          {stageFilter}
        </div>
      )}

      {showProfile && stageImage && (
        <Collapsible defaultOpen className="border-b bg-background shrink-0">
          <div className="w-full px-3 py-1.5 flex items-center justify-between bg-muted/20 gap-2">
            <CollapsibleTrigger className="flex items-center gap-1.5 whitespace-nowrap flex-1 min-w-0">
              <Route className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-semibold">Profil</h3>
              {stageImage.etape_numero != null && (
                <span className="text-[10px] text-muted-foreground">Étape {stageImage.etape_numero}</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <button
              type="button"
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors shrink-0"
              onClick={() => setZoomOpen(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Agrandir
            </button>
          </div>
          <CollapsibleContent>
            <div className="p-2">
              <img
                src={stageImage.image_url}
                alt={stageImage.label || (stageImage.etape_numero ? `Étape ${stageImage.etape_numero}` : "Parcours")}
                className="w-full h-auto max-h-56 object-contain object-center rounded-md border bg-muted cursor-zoom-in"
                loading="lazy"
                onClick={() => setZoomOpen(true)}
              />
            </div>

          </CollapsibleContent>
        </Collapsible>
      )}

      {stageImage && (
        <StageProfileZoomDialog
          open={zoomOpen}
          onOpenChange={setZoomOpen}
          imageUrl={stageImage.image_url}
          title={[courseName, stageImage.etape_numero != null ? `Étape ${stageImage.etape_numero}` : stageImage.label]
            .filter(Boolean)
            .join(" — ") || "Profil du parcours"}
          alt={stageImage.label || (stageImage.etape_numero ? `Étape ${stageImage.etape_numero}` : "Parcours")}
        />
      )}

      {/* Content: timeline + situation side by side */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Timeline column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-3 py-1.5 border-b bg-muted/20">
            <div className="flex items-center gap-1.5 min-w-0">
              <MessageCircle className="h-3.5 w-3.5 text-primary shrink-0" />
              <h3 className="text-xs font-semibold shrink-0">Timeline</h3>
              {situationUpdatedAt && (
                <span
                  className={cn(
                    "text-[10px] truncate ml-auto",
                    situationBehindTimeline ? "text-muted-foreground/50 italic" : "text-muted-foreground"
                  )}
                >
                  Situation mise à jour {formatRelativeFr(situationUpdatedAt, nowTick)}
                  {situationBehindTimeline ? " — actualisation…" : ""}
                </span>
              )}

            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messagesContent}
          </div>
        </div>

        {/* Situation column */}
        <div className={cn("flex flex-col shrink-0 border-l", situationWidth)}>
          <div className="px-3 py-1.5 border-b bg-muted/20">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-semibold">Situation</h3>
              {latestSituation && (
                <span className="text-[10px] text-muted-foreground">🏁 {latestSituation.kmRemaining} km</span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {raceSituationContent}
          </div>
        </div>
      </div>
    </div>
  );
};

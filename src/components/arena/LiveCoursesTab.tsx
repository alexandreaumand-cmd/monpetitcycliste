import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Image as ImageIcon, Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, Radio, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LiveStageBadge } from "./LiveStageBadge";
import { useLiveStageStatus } from "@/hooks/useLiveStageStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LiveCourseSelector, useLiveCourses } from "./LiveCourseSelector";
import { LiveCoursePanel } from "./LiveCoursePanel";
import { MessageBubble } from "./MessageBubble";
import { RaceSituationDisplay } from "./RaceSituationDisplay";
import {
  useArenaChannels,
  useArenaMessages,
  useArenaRealtime,
  useToggleReaction,
  useMessageReactions,
  useLeagueManagers,
  useLeagueRosterOwners,
} from "@/hooks/useArenaMessages";
import { useCurrentManagerId } from "@/hooks/useArenaPronostics";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface LiveCoursesTabProps {
  leagueId: string;
}

export const LiveCoursesTab = ({ leagueId }: LiveCoursesTabProps) => {
  const { t } = useTranslation("arena");
  const isMobile = useIsMobile();
  // Single-select for mobile
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  // Multi-select for desktop (max 2)
  const [activeCourseIds, setActiveCourseIds] = useState<string[]>([]);
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: managerId } = useCurrentManagerId();
  const { data: channels } = useArenaChannels(leagueId);
  const { data: managers = [] } = useLeagueManagers(leagueId);
  const { data: rosterOwners = {} } = useLeagueRosterOwners(leagueId, activeCourseId);
  const { data: liveCourses } = useLiveCourses();
  const currentEtape = liveCourses?.find((lc) => lc.course_id === activeCourseId)?.current_etape ?? null;
  const stageStatus = useLiveStageStatus(activeCourseId, currentEtape);

  const liveChannel = channels?.find((c) => c.slug === "live-courses");
  const channelId = liveChannel?.id || null;

  // Mobile: keep existing hooks for single course
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: messagesLoading,
  } = useArenaMessages(channelId, leagueId, activeCourseId);

  useArenaRealtime(channelId, leagueId);

  const toggleReaction = useToggleReaction();

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

  // Auto-select the stage being broadcast live whenever it changes
  useEffect(() => {
    setSelectedEtape(stageStatus.etape);
  }, [activeCourseId, stageStatus.etape]);

  const filteredMessages = useMemo(() => {
    if (selectedEtape == null) return allMessages;
    return allMessages.filter(
      (msg) => (msg.metadata as any)?.etape_numero === selectedEtape
    );
  }, [allMessages, selectedEtape]);

  const displayMessages = useMemo(() => filteredMessages, [filteredMessages]);

  const latestSituation = useMemo(() => {
    for (const msg of filteredMessages) {
      const sit = (msg.metadata as any)?.race_situation;
      const km = Number(sit?.kmRemaining);
      if ((sit?.groups?.length ?? 0) > 0 || Number.isFinite(km)) return sit;
    }
    return null;
  }, [filteredMessages]);

  const messageIds = useMemo(() => filteredMessages.map((m) => m.id), [filteredMessages]);
  const { data: reactionsMap = {} } = useMessageReactions(messageIds, managerId || null);

  const { data: routeImages } = useQuery({
    queryKey: ["course-route-images", activeCourseId],
    queryFn: async () => {
      if (!activeCourseId) return [];
      const { data } = await supabase
        .from("course_route_images")
        .select("etape_numero, image_url, label")
        .eq("course_id", activeCourseId);
      return data ?? [];
    },
    enabled: !!activeCourseId,
    staleTime: 5 * 60 * 1000,
  });

  const activeEtape = selectedEtape ?? stageStatus.etape;
  const stageImage = useMemo(() => {
    if (!routeImages || routeImages.length === 0) return null;
    if (activeEtape != null) {
      const match = routeImages.find((img) => img.etape_numero === activeEtape);
      if (match) return match;
    }
    return routeImages.find((img) => img.etape_numero == null) ?? null;
  }, [routeImages, activeEtape]);

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!managerId) return;
      toggleReaction.mutate({ messageId, managerId, emoji });
    },
    [managerId, toggleReaction]
  );

  // Get course name by id
  const getCourseNameById = useCallback(
    (courseId: string) => {
      const lc = liveCourses?.find((c) => c.course_id === courseId);
      return lc?.courses?.nom || courseId;
    },
    [liveCourses]
  );

  // Desktop top profile: stage profile of the first selected live course, shown next to the selector
  const desktopCourseId = activeCourseIds[0] || null;
  const desktopCurrentEtape = liveCourses?.find((lc) => lc.course_id === desktopCourseId)?.current_etape ?? null;
  const desktopStageStatus = useLiveStageStatus(desktopCourseId, desktopCurrentEtape);
  const { data: desktopRouteImages } = useQuery({
    queryKey: ["course-route-images", desktopCourseId],
    queryFn: async () => {
      if (!desktopCourseId) return [];
      const { data } = await supabase
        .from("course_route_images")
        .select("etape_numero, image_url, label")
        .eq("course_id", desktopCourseId);
      return data ?? [];
    },
    enabled: !!desktopCourseId,
    staleTime: 5 * 60 * 1000,
  });
  const desktopStageImage = useMemo(() => {
    if (!desktopRouteImages || desktopRouteImages.length === 0) return null;
    if (desktopStageStatus.etape != null) {
      const match = desktopRouteImages.find((img) => img.etape_numero === desktopStageStatus.etape);
      if (match) return match;
    }
    return desktopRouteImages.find((img) => img.etape_numero == null) ?? null;
  }, [desktopRouteImages, desktopStageStatus.etape]);

  if (!managerId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("pronostics.noManager")}
      </div>
    );
  }

  // ── MOBILE LAYOUT ── (unchanged, single-select)
  if (isMobile) {
    const courseSelector = (
      <div className="px-4 py-3 border-b bg-muted/20 space-y-2">
        <LiveCourseSelector
          activeCourseId={activeCourseId}
          onSelect={setActiveCourseId}
        />
        {activeCourseId && (
          <LiveStageBadge etape={stageStatus.etape} state={stageStatus.state} className="text-[11px] px-2.5 py-1" />
        )}
      </div>
    );

    const stageFilter = activeCourseId && availableStages.length > 1 && (
      <div className="px-4 py-2.5 border-b flex items-center gap-2 overflow-x-auto bg-muted/10">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Étape :</span>
        <Badge
          variant={selectedEtape == null ? "default" : "outline"}
          className={cn(
            "cursor-pointer min-h-[28px] px-2.5 py-0.5 text-xs whitespace-nowrap",
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
                "cursor-pointer min-h-[28px] px-2.5 py-0.5 text-xs whitespace-nowrap gap-1",
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

    const messagesContent = !activeCourseId ? (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Radio className="h-10 w-10 mb-3 opacity-20" />
        <p className="font-medium text-sm">{t("trashTalk.liveCourses.selectPrompt")}</p>
      </div>
    ) : messagesLoading ? (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ) : displayMessages.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <MessageCircle className="h-10 w-10 mb-3 opacity-20" />
        <p className="font-medium text-sm">{t("trashTalk.empty")}</p>
        <p className="text-xs mt-1">{t("trashTalk.emptyDesc")}</p>
      </div>
    ) : (
      <div className="py-3 space-y-0.5">
        {displayMessages.map((msg, idx) => {
          const prevMsg = idx > 0 ? displayMessages[idx - 1] : null;
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
              onToggleReaction={(emoji) => handleToggleReaction(msg.id, emoji)}
              isOwnMessage={msg.author_manager_id === managerId}
              showAuthor={showAuthor}
              disabled={!managerId}
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
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <MapPin className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-xs text-center">Aucune situation de course disponible</p>
        <p className="text-[11px] mt-1 text-center opacity-70">La situation apparaîtra quand l'admin diffusera les données de course</p>
      </div>
    );

    return (
      <div className="flex flex-col gap-3 min-h-[400px]">
        <Collapsible defaultOpen={!activeCourseId} className="border rounded-xl overflow-hidden bg-background">
          <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between bg-muted/20 border-b">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Choisir une course</h3>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {courseSelector}
            {stageFilter}
          </CollapsibleContent>
        </Collapsible>

        {activeCourseId && (
          <>
            {stageImage && (
              <Collapsible defaultOpen className="border rounded-xl overflow-hidden bg-background">
                <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between bg-muted/20 border-b">
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Profil</h3>
                    {stageImage.etape_numero != null && (
                      <span className="text-[11px] text-muted-foreground">Étape {stageImage.etape_numero}</span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3">
                    <img
                      src={stageImage.image_url}
                      alt={stageImage.label || `Étape ${stageImage.etape_numero ?? ''}`}
                      className="w-full h-auto rounded-md border"
                      loading="lazy"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Collapsible defaultOpen className="border rounded-xl overflow-hidden bg-background">
              <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between bg-muted/20 border-b">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Situation de course</h3>
                  {latestSituation && <span className="text-[11px] text-muted-foreground">🏁 {latestSituation.kmRemaining} km</span>}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 max-h-[50vh] overflow-y-auto">
                  {raceSituationContent}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible defaultOpen className="border rounded-xl overflow-hidden bg-background flex-1">
              <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between bg-muted/20 border-b">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Timeline</h3>
                  {displayMessages.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">{displayMessages.length} msg</span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="max-h-[60vh] overflow-y-auto">
                  {messagesContent}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {!activeCourseId && messagesContent}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ── (multi-select, side-by-side panels)
  const hasMultipleCourses = activeCourseIds.length > 1;

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh-160px)] min-h-[400px]">
      {/* Course selector — compact, with stage profile alongside when a course is selected */}
      <div className="flex gap-3 shrink-0">
        <Collapsible
          defaultOpen={activeCourseIds.length === 0}
          className="border rounded-xl overflow-hidden bg-background shrink-0"
          style={{ width: activeCourseIds.length === 1 ? "320px" : "100%" }}
        >
          <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between bg-muted/20 border-b">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Choisir une course</h3>
              {activeCourseIds.length > 0 && (
                <span className="text-[11px] text-muted-foreground">{activeCourseIds.length} sélectionnée{activeCourseIds.length > 1 ? 's' : ''}</span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 py-2 bg-muted/20">
              <LiveCourseSelector
                activeCourseId={activeCourseIds[0] || null}
                onSelect={(id) => setActiveCourseIds(id ? [id] : [])}
                multiSelect
                activeCourseIds={activeCourseIds}
                onSelectMulti={setActiveCourseIds}
                compact
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {activeCourseIds.length === 1 && desktopStageImage && (
          <Collapsible
            defaultOpen
            className="border rounded-xl overflow-hidden bg-background flex-1 min-w-0 flex flex-col"
          >
            <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between bg-muted/20 border-b">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Profil</h3>
                {desktopStageImage.etape_numero != null && (
                  <span className="text-[11px] text-muted-foreground">Étape {desktopStageImage.etape_numero}</span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex-1 bg-background min-h-0">
              <div className="h-full p-2 flex items-center justify-center min-h-0">
                <img
                  src={desktopStageImage.image_url}
                  alt={desktopStageImage.label || (desktopStageImage.etape_numero ? `Étape ${desktopStageImage.etape_numero}` : "Parcours")}
                  className="max-w-full max-h-[260px] h-auto object-contain rounded-md border bg-muted"
                  loading="lazy"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Panels */}
      {activeCourseIds.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border rounded-xl bg-background">
          <div className="text-center text-muted-foreground">
            <Radio className="h-10 w-10 mb-3 opacity-20 mx-auto" />
            <p className="font-medium text-sm">{t("trashTalk.liveCourses.selectPrompt")}</p>
          </div>
        </div>
      ) : (
        <div className={cn("flex gap-3 flex-1 overflow-hidden min-h-0", hasMultipleCourses && "")}>
          {activeCourseIds.map((courseId) => (
            <LiveCoursePanel
              key={courseId}
              leagueId={leagueId}
              courseId={courseId}
              channelId={channelId || ""}
              managerId={managerId}
              courseName={hasMultipleCourses ? getCourseNameById(courseId) : undefined}
              onToggleReaction={handleToggleReaction}
              compact={hasMultipleCourses}
              showProfile={activeCourseIds.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

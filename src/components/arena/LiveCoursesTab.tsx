import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, Radio, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveCourseSelector } from "./LiveCourseSelector";
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
import { cn } from "@/lib/utils";

interface LiveCoursesTabProps {
  leagueId: string;
}

export const LiveCoursesTab = ({ leagueId }: LiveCoursesTabProps) => {
  const { t } = useTranslation("arena");
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { data: managerId } = useCurrentManagerId();
  const { data: channels } = useArenaChannels(leagueId);
  const { data: managers = [] } = useLeagueManagers(leagueId);
  const { data: rosterOwners = {} } = useLeagueRosterOwners(leagueId, activeCourseId);

  const liveChannel = channels?.find((c) => c.slug === "live-courses");
  const channelId = liveChannel?.id || null;

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

  // Extract available stages from messages metadata
  const availableStages = useMemo(() => {
    const stages = new Set<number>();
    allMessages.forEach((msg) => {
      const etape = (msg.metadata as any)?.etape_numero;
      if (etape != null) stages.add(etape);
    });
    return Array.from(stages).sort((a, b) => a - b);
  }, [allMessages]);

  // Reset stage filter when course changes
  useEffect(() => {
    setSelectedEtape(null);
  }, [activeCourseId]);

  // Filter messages by selected stage
  const filteredMessages = useMemo(() => {
    if (selectedEtape == null) return allMessages;
    return allMessages.filter(
      (msg) => (msg.metadata as any)?.etape_numero === selectedEtape
    );
  }, [allMessages, selectedEtape]);

  // Extract latest race situation from messages
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

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!managerId) return;
      toggleReaction.mutate({ messageId, managerId, emoji });
    },
    [managerId, toggleReaction]
  );

  if (!managerId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("pronostics.noManager")}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-260px)] min-h-[400px]">
      {/* Left: Messages feed */}
      <div className="flex-1 flex flex-col border rounded-xl overflow-hidden bg-background min-w-0">
        {/* Course selector */}
        <div className="px-4 py-3 border-b bg-muted/20">
          <LiveCourseSelector
            activeCourseId={activeCourseId}
            onSelect={setActiveCourseId}
          />
        </div>

        {/* Stage filter chips */}
        {activeCourseId && availableStages.length > 1 && (
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
            {availableStages.map((stage) => (
              <Badge
                key={stage}
                variant={selectedEtape === stage ? "default" : "outline"}
                className={cn(
                  "cursor-pointer min-h-[28px] px-2.5 py-0.5 text-xs whitespace-nowrap",
                  "active:scale-95 transition-all"
                )}
                onClick={() => setSelectedEtape(stage)}
              >
                É{stage}
              </Badge>
            ))}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">

          {!activeCourseId ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Radio className="h-10 w-10 mb-3 opacity-20" />
              <p className="font-medium text-sm">{t("trashTalk.liveCourses.selectPrompt")}</p>
            </div>
          ) : messagesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <MessageCircle className="h-10 w-10 mb-3 opacity-20" />
              <p className="font-medium text-sm">{t("trashTalk.empty")}</p>
              <p className="text-xs mt-1">{t("trashTalk.emptyDesc")}</p>
            </div>
          ) : (
            <div className="py-3 space-y-0.5">
              {filteredMessages.map((msg, idx) => {
                const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
                const showAuthor =
                  !prevMsg ||
                  prevMsg.author_manager_id !== msg.author_manager_id ||
                  msg.message_type !== prevMsg.message_type ||
                  new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000;

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
          )}
        </div>

      </div>

      {/* Right: Race situation panel (desktop only) */}
      {activeCourseId && (
        <>
        {/* Desktop: always visible side panel */}
        <div className="hidden lg:flex flex-col w-[340px] shrink-0 border rounded-xl overflow-hidden bg-background">
          <div className="px-4 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Situation de course</h3>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {latestSituation ? (
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
            )}
          </div>
        </div>

        {/* Mobile: collapsible accordion */}
        <Collapsible className="lg:hidden border rounded-xl overflow-hidden bg-background">
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
              {latestSituation ? (
                <div className="space-y-3">
                  {latestSituation.groups.map((group: any, gi: number) => (
                    <div key={gi} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-semibold", group.isPeloton ? "text-primary" : "text-foreground")}>{group.name}</span>
                        <div className="flex items-center gap-2">
                          {group.gap !== "0:00" && <span className="text-[11px] text-muted-foreground">{group.gap.startsWith("+") ? group.gap : `+${group.gap}`}</span>}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0"><Users className="h-2.5 w-2.5 mr-0.5" />{group.riderCount}</Badge>
                        </div>
                      </div>
                      {group.riders?.length > 0 && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-primary/30">
                          {group.riders.map((riderName: string, ri: number) => {
                            const riderId = group.riderIds?.[ri];
                            const normalizedName = riderName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();
                            const managerName = (riderId && rosterOwners?.[riderId]) || rosterOwners?.[`name:${normalizedName}`];
                            return (<div key={ri} className="text-xs py-0.5"><span className="font-medium text-foreground">{riderName}{managerName ? ` (${managerName})` : ""}</span></div>);
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-center text-muted-foreground py-4">Aucune situation de course disponible</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
        </>
      )}
    </div>
  );
};

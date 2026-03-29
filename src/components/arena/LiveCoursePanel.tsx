import { useState, useRef, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, Radio, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "./MessageBubble";
import { RaceSituationDisplay } from "./RaceSituationDisplay";
import {
  useArenaMessages,
  useMessageReactions,
  useLeagueRosterOwners,
} from "@/hooks/useArenaMessages";
import { cn } from "@/lib/utils";

interface LiveCoursePanelProps {
  leagueId: string;
  courseId: string;
  channelId: string;
  managerId: string;
  courseName?: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  compact?: boolean;
}

export const LiveCoursePanel = ({
  leagueId,
  courseId,
  channelId,
  managerId,
  courseName,
  onToggleReaction,
  compact = false,
}: LiveCoursePanelProps) => {
  const { t } = useTranslation("arena");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: rosterOwners = {} } = useLeagueRosterOwners(leagueId, courseId);

  const {
    data: messagesData,
    isLoading: messagesLoading,
  } = useArenaMessages(channelId, leagueId, courseId);

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
    return Array.from(stages).sort((a, b) => a - b);
  }, [allMessages]);

  useEffect(() => {
    setSelectedEtape(null);
  }, [courseId]);

  const filteredMessages = useMemo(() => {
    if (selectedEtape == null) return allMessages;
    return allMessages.filter(
      (msg) => (msg.metadata as any)?.etape_numero === selectedEtape
    );
  }, [allMessages, selectedEtape]);

  const latestSituation = useMemo(() => {
    for (const msg of filteredMessages) {
      const sit = (msg.metadata as any)?.race_situation;
      const km = Number(sit?.kmRemaining);
      if ((sit?.groups?.length ?? 0) > 0 || Number.isFinite(km)) return sit;
    }
    return null;
  }, [filteredMessages]);

  const messageIds = useMemo(() => filteredMessages.map((m) => m.id), [filteredMessages]);
  const { data: reactionsMap = {} } = useMessageReactions(messageIds, managerId);

  const stageFilter = availableStages.length > 1 && (
    <div className="px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto bg-muted/10">
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
      {availableStages.map((stage) => (
        <Badge
          key={stage}
          variant={selectedEtape === stage ? "default" : "outline"}
          className={cn(
            "cursor-pointer min-h-[24px] px-2 py-0.5 text-xs whitespace-nowrap",
            "active:scale-95 transition-all"
          )}
          onClick={() => setSelectedEtape(stage)}
        >
          É{stage}
        </Badge>
      ))}
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

  const situationWidth = compact ? "w-[260px]" : "w-[320px]";

  return (
    <div className="flex flex-col flex-1 border rounded-xl overflow-hidden bg-background min-w-0">
      {/* Course name header */}
      {courseName && (
        <div className="px-3 py-2 border-b bg-primary/5">
          <span className="text-xs font-bold text-primary truncate">{courseName}</span>
        </div>
      )}

      {stageFilter}

      {/* Content: timeline + situation side by side */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Timeline column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-3 py-1.5 border-b bg-muted/20">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-semibold">Timeline</h3>
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

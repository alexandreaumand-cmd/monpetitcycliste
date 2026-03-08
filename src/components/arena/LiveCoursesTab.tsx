import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveCourseSelector } from "./LiveCourseSelector";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
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

interface LiveCoursesTabProps {
  leagueId: string;
}

export const LiveCoursesTab = ({ leagueId }: LiveCoursesTabProps) => {
  const { t } = useTranslation("arena");
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { data: managerId } = useCurrentManagerId();
  const { data: channels } = useArenaChannels(leagueId);
  const { data: managers = [] } = useLeagueManagers(leagueId);
  const { data: rosterOwners = {} } = useLeagueRosterOwners(leagueId);

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
    return messagesData.pages.flatMap((p) => p.messages).reverse();
  }, [messagesData]);

  const messageIds = useMemo(() => allMessages.map((m) => m.id), [allMessages]);
  const { data: reactionsMap = {} } = useMessageReactions(messageIds, managerId || null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages.length, autoScroll]);

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
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px] border rounded-lg overflow-hidden bg-background">
      {/* Course selector */}
      <div className="p-3 border-b">
        <LiveCourseSelector
          activeCourseId={activeCourseId}
          onSelect={setActiveCourseId}
        />
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {hasNextPage && (
          <div className="flex justify-center py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("trashTalk.loadMore")}
            </Button>
          </div>
        )}

        {!activeCourseId ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-30" />
            <p className="font-medium">{t("trashTalk.liveCourses.selectPrompt")}</p>
          </div>
        ) : messagesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-30" />
            <p className="font-medium">{t("trashTalk.empty")}</p>
            <p className="text-sm">{t("trashTalk.emptyDesc")}</p>
          </div>
        ) : (
          <div className="py-2">
            {allMessages.map((msg, idx) => {
              const prevMsg = idx > 0 ? allMessages[idx - 1] : null;
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

      {/* Read-only indicator */}
      <MessageInput
        onSend={() => {}}
        managers={managers}
        disabled
        readOnly
      />
    </div>
  );
};

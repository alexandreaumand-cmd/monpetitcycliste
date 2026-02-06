import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChannelSelector } from "./ChannelSelector";
import { LiveCourseSelector } from "./LiveCourseSelector";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import {
  useArenaChannels,
  useArenaMessages,
  useArenaRealtime,
  useSendArenaMessage,
  useBroadcastLiveMessage,
  useToggleReaction,
  useMessageReactions,
  useLeagueManagers,
  useLeagueRosterOwners,
} from "@/hooks/useArenaMessages";
import { useCurrentManagerId, useStartlistRiders } from "@/hooks/useArenaPronostics";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

interface TrashTalkTabProps {
  leagueId: string;
}

export const TrashTalkTab = ({ leagueId }: TrashTalkTabProps) => {
  const { t } = useTranslation("arena");
  const [activeSlug, setActiveSlug] = useState<string>("general");
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { data: managerId } = useCurrentManagerId();
  const { isSuperAdmin } = useUserRole();
  const { data: channels } = useArenaChannels(leagueId);
  const { data: managers = [] } = useLeagueManagers(leagueId);
  const { data: rosterOwners = {} } = useLeagueRosterOwners(leagueId);

  // Fetch startlist riders for the active live course
  const { data: startlistRiders = [] } = useStartlistRiders(
    activeSlug === "live-courses" ? activeCourseId : null
  );

  const activeChannel = channels?.find((c) => c.slug === activeSlug);
  const channelId = activeChannel?.id || null;

  // For live-courses, filter messages by selected course
  const courseFilter = activeSlug === "live-courses" ? activeCourseId : null;

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: messagesLoading,
  } = useArenaMessages(channelId, leagueId, courseFilter);

  useArenaRealtime(channelId, leagueId);

  const sendMessage = useSendArenaMessage();
  const broadcastMessage = useBroadcastLiveMessage();
  const toggleReaction = useToggleReaction();

  // Flatten pages → chronological order (oldest first)
  const allMessages = useMemo(() => {
    if (!messagesData?.pages) return [];
    return messagesData.pages.flatMap((p) => p.messages).reverse();
  }, [messagesData]);

  // Reactions
  const messageIds = useMemo(() => allMessages.map((m) => m.id), [allMessages]);
  const { data: reactionsMap = {} } = useMessageReactions(
    messageIds,
    managerId || null
  );

  // Auto-scroll to bottom
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

  const handleSend = useCallback(
    (content: string, metadata?: any) => {
      if (!managerId) return;

      // Super-admin in live-courses uses broadcast to ALL leagues
      if (activeSlug === "live-courses" && isSuperAdmin && activeCourseId) {
        broadcastMessage.mutate(
          {
            content,
            courseId: activeCourseId,
            managerId,
            metadata,
          },
          {
            onSuccess: (data) => {
              toast.success(t("trashTalk.broadcast.success", { count: data.leagues_count }));
            },
            onError: (error: any) => {
              toast.error(error.message || t("trashTalk.sendError"));
            },
          }
        );
      } else {
        // Regular message to current league's channel
        if (!channelId) return;
        
        sendMessage.mutate(
          {
            channelId,
            leagueId,
            managerId,
            content,
            messageType: "user",
            metadata,
          },
          {
            onError: (error: any) => {
              toast.error(error.message || t("trashTalk.sendError"));
            },
          }
        );
      }

      setAutoScroll(true);
    },
    [channelId, leagueId, managerId, activeSlug, activeCourseId, isSuperAdmin, sendMessage, broadcastMessage, t]
  );

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!managerId) return;
      toggleReaction.mutate({ messageId, managerId, emoji });
    },
    [managerId, toggleReaction]
  );

  // live-courses is read-only except for super-admins
  const isReadOnly = activeSlug === "live-courses" && !isSuperAdmin;
  // For live-courses, require a selected course to send messages
  const canSend = activeSlug !== "live-courses" || (isSuperAdmin && !!activeCourseId);

  // Reset course selection when switching away from live-courses
  useEffect(() => {
    if (activeSlug !== "live-courses") {
      setActiveCourseId(null);
    }
  }, [activeSlug]);

  if (!managerId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("pronostics.noManager")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px] border rounded-lg overflow-hidden bg-background">
      {/* Channel selector */}
      <div className="p-3 border-b space-y-2">
        <ChannelSelector activeChannel={activeSlug} onSelect={setActiveSlug} />
        {activeSlug === "live-courses" && (
          <>
            <LiveCourseSelector
              activeCourseId={activeCourseId}
              onSelect={setActiveCourseId}
              isSuperAdmin={isSuperAdmin}
            />
            {/* Broadcast mode indicator for super-admin */}
            {isSuperAdmin && activeCourseId && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                <Radio className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-xs font-medium text-primary">
                  {t("trashTalk.broadcast.indicator")}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {/* Load more */}
        {hasNextPage && (
          <div className="flex justify-center py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {t("trashTalk.loadMore")}
            </Button>
          </div>
        )}

        {activeSlug === "live-courses" && !activeCourseId ? (
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
                new Date(msg.created_at).getTime() -
                  new Date(prevMsg.created_at).getTime() >
                  5 * 60 * 1000;

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  reactions={reactionsMap[msg.id] || []}
                  onToggleReaction={(emoji) =>
                    handleToggleReaction(msg.id, emoji)
                  }
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

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        managers={managers}
        riders={startlistRiders}
        disabled={sendMessage.isPending || broadcastMessage.isPending || !canSend}
        readOnly={isReadOnly}
      />
    </div>
  );
};

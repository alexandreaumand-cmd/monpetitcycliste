import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Bot, Radio, Shield } from "lucide-react";
import { ReactionBar } from "./ReactionBar";
import { RaceSituationDisplay } from "./RaceSituationDisplay";
import { type ArenaMessage, type ReactionSummary } from "@/hooks/useArenaMessages";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";

interface MessageBubbleProps {
  message: ArenaMessage;
  reactions: ReactionSummary[];
  onToggleReaction: (emoji: string) => void;
  isOwnMessage: boolean;
  showAuthor: boolean;
  disabled?: boolean;
  rosterOwners?: Record<string, string>;
}

export const MessageBubble = ({
  message,
  reactions,
  onToggleReaction,
  isOwnMessage,
  showAuthor,
  disabled,
  rosterOwners,
}: MessageBubbleProps) => {
  const { t, i18n } = useTranslation("arena");
  const dateLocale = i18n.language === "fr" ? fr : enUS;

  const isSystem = message.message_type === "system";
  const isBroadcast = message.message_type === "admin_broadcast";
  const isAdmin = isBroadcast || message.message_type === "admin_local";

  const timeStr = useMemo(
    () => format(new Date(message.created_at), "HH:mm", { locale: dateLocale }),
    [message.created_at, dateLocale]
  );

  // Build a map from rider name → coureur_id from metadata
  const riderMentionMap = useMemo(() => {
    const map: Record<string, string> = {};
    const mentions = message.metadata?.rider_mentions;
    if (Array.isArray(mentions)) {
      for (const m of mentions) {
        if (m.rider_nom && m.coureur_id) {
          map[m.rider_nom] = m.coureur_id;
        }
      }
    }
    return map;
  }, [message.metadata]);

  // Render content with @mentions and {rider} mentions
  const renderedContent = useMemo(() => {
    // Split on @mentions, {RiderName}, and **bold** patterns
    return message.content.split(/([@][^\s@#]+|\{[^}]+\}|\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="font-semibold text-primary">
            {part}
          </span>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i}>{part.slice(2, -2)}</strong>
        );
      }
      if (part.startsWith("{") && part.endsWith("}")) {
        const riderName = part.slice(1, -1);
        const coureurId = riderMentionMap[riderName];
        const ownerName = coureurId && rosterOwners?.[coureurId];

        return (
          <span key={i} className="inline-flex items-baseline gap-0.5">
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {riderName}
            </span>
            {ownerName && (
              <span className="text-[10px] font-medium text-muted-foreground">
                ({ownerName})
              </span>
            )}
          </span>
        );
      }
      return part;
    });
  }, [message.content, riderMentionMap, rosterOwners]);

  // System message
  if (isSystem) {
    const isLongSystem = message.content.includes("\n");

    // Long system messages (recaps) → card-style display
    if (isLongSystem) {
      return (
        <div className="px-3 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Bot className="h-3 w-3" />
              <span>{timeStr}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">
              {message.content.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return <strong key={i}>{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </div>
          </div>
        </div>
      );
    }

    // Short system messages → centered separator
    return (
      <div className="flex items-center gap-2 py-2 px-3">
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
          <Bot className="h-3 w-3" />
          <span>{message.content}</span>
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex gap-2 px-3 py-1 hover:bg-muted/30 transition-colors",
        !isBroadcast && isOwnMessage && "flex-row-reverse"
      )}
    >
      {/* Avatar — for broadcasts show a generic radio icon */}
      {showAuthor ? (
        isBroadcast ? (
          <div className="h-8 w-8 mt-0.5 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
            <Radio className="h-4 w-4 text-primary" />
          </div>
        ) : (
          <Avatar className="h-8 w-8 mt-0.5 shrink-0">
            <AvatarImage src={message.author?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {message.author?.nom?.substring(0, 2).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        )
      ) : (
        <div className="w-8 shrink-0" />
      )}

      {/* Body */}
      <div className={cn("flex-1 min-w-0", !isBroadcast && isOwnMessage && "text-right")}>
        {showAuthor && (
          <div
            className={cn(
              "flex items-center gap-2 mb-0.5",
              !isBroadcast && isOwnMessage && "flex-row-reverse"
            )}
          >
            {isBroadcast ? (
              <span className="text-sm font-semibold text-primary">📡 Live</span>
            ) : (
              <>
                <span className="text-sm font-semibold">
                  {message.author?.nom || t("trashTalk.system")}
                </span>
                {isAdmin && <Shield className="h-3 w-3 text-primary" />}
              </>
            )}
            <span className="text-xs text-muted-foreground">{timeStr}</span>
          </div>
        )}

        <div
          className={cn(
            "text-sm whitespace-pre-wrap break-words",
            isAdmin && "font-medium text-primary"
          )}
        >
          {renderedContent}
        </div>

        {/* Race situation visualization */}
        {(message.metadata as any)?.race_situation && (
          <div className="mt-2">
            <RaceSituationDisplay
              groups={(message.metadata as any).race_situation.groups}
              kmRemaining={(message.metadata as any).race_situation.kmRemaining}
              rosterOwners={rosterOwners}
            />
          </div>
        )}

        {/* Reactions */}
        <div className={cn("mt-1", !isBroadcast && isOwnMessage && "flex justify-end")}>
          <ReactionBar
            reactions={reactions}
            onToggle={onToggleReaction}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

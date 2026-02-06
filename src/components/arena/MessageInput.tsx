import { useState, useRef, KeyboardEvent, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Send, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type LeagueManager } from "@/hooks/useArenaMessages";
import { type StartlistRider } from "@/hooks/useArenaPronostics";

interface MessageInputProps {
  onSend: (content: string, metadata?: any) => void;
  managers: LeagueManager[];
  riders?: StartlistRider[];
  disabled?: boolean;
  readOnly?: boolean;
}

type SuggestionMode = "manager" | "rider" | null;

interface Suggestion {
  id: string;
  label: string;
  secondary?: string;
  mode: "manager" | "rider";
}

export const MessageInput = ({
  onSend,
  managers,
  riders = [],
  disabled,
  readOnly,
}: MessageInputProps) => {
  const { t } = useTranslation("arena");
  const [content, setContent] = useState("");
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>(null);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredSuggestions = useMemo<Suggestion[]>(() => {
    if (!suggestionMode) return [];
    const q = suggestionQuery.toLowerCase();

    if (suggestionMode === "manager") {
      return managers
        .filter((m) => m.nom.toLowerCase().includes(q))
        .slice(0, 6)
        .map((m) => ({ id: m.id, label: m.nom, mode: "manager" as const }));
    }

    if (suggestionMode === "rider") {
      return riders
        .filter((r) => r.nom.toLowerCase().includes(q))
        .slice(0, 8)
        .map((r) => ({
          id: r.coureur_id,
          label: r.nom,
          secondary: r.team || undefined,
          mode: "rider" as const,
        }));
    }

    return [];
  }, [suggestionMode, suggestionQuery, managers, riders]);

  const showSuggestions = filteredSuggestions.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Check for # (rider mention) — match everything after # until start of line or previous space
    const hashMatch = textBeforeCursor.match(/#([^\n#@]*)$/);
    const atMatch = textBeforeCursor.match(/@([^\s#@]*)$/);

    if (hashMatch && riders.length > 0) {
      setSuggestionMode("rider");
      setSuggestionQuery(hashMatch[1].trim());
      setSuggestionIndex(0);
    } else if (atMatch) {
      setSuggestionMode("manager");
      setSuggestionQuery(atMatch[1]);
      setSuggestionIndex(0);
    } else {
      setSuggestionMode(null);
    }
  };

  const insertSuggestion = (suggestion: Suggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);

    if (suggestion.mode === "manager") {
      const match = textBeforeCursor.match(/@([^\s#@]*)$/);
      if (match) {
        const beforeTrigger = content.slice(0, cursorPos - match[0].length);
        const afterCursor = content.slice(cursorPos);
        const newContent = `${beforeTrigger}@${suggestion.label} ${afterCursor}`;
        setContent(newContent);
        setSuggestionMode(null);

        setTimeout(() => {
          textarea.focus();
          const newPos = beforeTrigger.length + suggestion.label.length + 2;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }
    } else if (suggestion.mode === "rider") {
      // For riders, replace #query with {RiderName} (curly braces to handle multi-word names)
      const match = textBeforeCursor.match(/#([^\n#@]*)$/);
      if (match) {
        const beforeTrigger = content.slice(0, cursorPos - match[0].length);
        const afterCursor = content.slice(cursorPos);
        const riderTag = `{${suggestion.label}}`;
        const newContent = `${beforeTrigger}${riderTag} ${afterCursor}`;
        setContent(newContent);
        setSuggestionMode(null);

        setTimeout(() => {
          textarea.focus();
          const newPos = beforeTrigger.length + riderTag.length + 1;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex((i) =>
          Math.min(i + 1, filteredSuggestions.length - 1)
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertSuggestion(filteredSuggestions[suggestionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setSuggestionMode(null);
        return;
      }
    }

    // Enter without Shift → send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled || readOnly) return;

    const metadata: any = {};

    // Extract @manager mentions
    const mentionMatches = trimmed.match(/@([^\s#@]+)/g);
    if (mentionMatches) {
      const mentionedManagers = mentionMatches
        .map((m) => m.slice(1))
        .map((name) => managers.find((mgr) => mgr.nom === name))
        .filter(Boolean);

      if (mentionedManagers.length > 0) {
        metadata.mentions = mentionedManagers.map((m) => ({
          manager_id: m!.id,
          manager_nom: m!.nom,
        }));
      }
    }

    // Extract {RiderName} rider mentions
    const riderMatches = trimmed.match(/\{([^}]+)\}/g);
    if (riderMatches && riders.length > 0) {
      const mentionedRiders = riderMatches
        .map((m) => m.slice(1, -1)) // Remove { and }
        .map((name) => riders.find((r) => r.nom === name))
        .filter(Boolean);

      if (mentionedRiders.length > 0) {
        metadata.rider_mentions = mentionedRiders.map((r) => ({
          coureur_id: r!.coureur_id,
          rider_nom: r!.nom,
        }));
      }
    }

    onSend(trimmed, Object.keys(metadata).length > 0 ? metadata : undefined);
    setContent("");
    setSuggestionMode(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  if (readOnly) {
    return (
      <div className="px-4 py-3 bg-muted/50 border-t text-sm text-muted-foreground text-center">
        {t("trashTalk.placeholderReadOnly")}
      </div>
    );
  }

  return (
    <div className="relative border-t bg-background">
      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-popover border rounded-lg shadow-lg overflow-hidden z-50 max-h-[240px] overflow-y-auto">
          {suggestionMode === "rider" && (
            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b bg-muted/30 flex items-center gap-1">
              <Bike className="h-3 w-3" />
              {t("trashTalk.riderMentions", { defaultValue: "Coureurs" })}
            </div>
          )}
          {filteredSuggestions.map((suggestion, i) => (
            <button
              key={`${suggestion.mode}-${suggestion.id}`}
              onClick={() => insertSuggestion(suggestion)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                i === suggestionIndex ? "bg-accent" : "hover:bg-muted"
              )}
            >
              <span className="font-medium">
                {suggestion.mode === "rider" ? "🚴 " : "@"}
                {suggestion.label}
              </span>
              {suggestion.secondary && (
                <span className="text-xs text-muted-foreground truncate">
                  {suggestion.secondary}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            riders.length > 0
              ? t("trashTalk.placeholderWithRiders", {
                  defaultValue: "Message... (@manager, #coureur)",
                })
              : t("trashTalk.placeholder")
          }
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[36px] max-h-[120px] py-2"
          style={{ height: "auto" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          }}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!content.trim() || disabled}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

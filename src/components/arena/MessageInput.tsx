import { useState, useRef, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type LeagueManager } from "@/hooks/useArenaMessages";

interface MessageInputProps {
  onSend: (content: string, metadata?: any) => void;
  managers: LeagueManager[];
  disabled?: boolean;
  readOnly?: boolean;
}

export const MessageInput = ({
  onSend,
  managers,
  disabled,
  readOnly,
}: MessageInputProps) => {
  const { t } = useTranslation("arena");
  const [content, setContent] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredManagers =
    mentionQuery !== null
      ? managers
          .filter((m) =>
            m.nom.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 6)
      : [];

  const showMentions = mentionQuery !== null && filteredManagers.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (manager: LeagueManager) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);

    if (atMatch) {
      const beforeAt = content.slice(0, cursorPos - atMatch[0].length);
      const afterCursor = content.slice(cursorPos);
      const newContent = `${beforeAt}@${manager.nom} ${afterCursor}`;
      setContent(newContent);
      setMentionQuery(null);

      setTimeout(() => {
        textarea.focus();
        const newPos = beforeAt.length + manager.nom.length + 2; // +2 for @ and space
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredManagers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredManagers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
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

    // Extract mentioned managers from content
    const mentionMatches = trimmed.match(/@(\S+)/g);
    const metadata: any = {};
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

    onSend(trimmed, Object.keys(metadata).length > 0 ? metadata : undefined);
    setContent("");
    setMentionQuery(null);

    // Reset textarea height
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
      {/* Mention suggestions */}
      {showMentions && (
        <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-popover border rounded-lg shadow-lg overflow-hidden z-50">
          {filteredManagers.map((manager, i) => (
            <button
              key={manager.id}
              onClick={() => insertMention(manager)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                i === mentionIndex ? "bg-accent" : "hover:bg-muted"
              )}
            >
              <span className="font-medium">@{manager.nom}</span>
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
          placeholder={t("trashTalk.placeholder")}
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

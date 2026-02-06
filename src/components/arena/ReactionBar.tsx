import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type ReactionSummary } from "@/hooks/useArenaMessages";

const EMOJI_MAP: Record<string, string> = {
  fire: "🔥",
  laugh: "😂",
  trophy: "🏆",
  thumbsup: "👍",
  skull: "💀",
};

const ALL_EMOJIS = Object.keys(EMOJI_MAP);

interface ReactionBarProps {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
  disabled?: boolean;
}

export const ReactionBar = ({ reactions, onToggle, disabled }: ReactionBarProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
            r.hasReacted
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>{EMOJI_MAP[r.emoji] || r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top" align="start">
          <div className="flex gap-1">
            {ALL_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onToggle(emoji);
                  setPickerOpen(false);
                }}
                className="p-1.5 rounded hover:bg-muted transition-colors text-lg"
              >
                {EMOJI_MAP[emoji]}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

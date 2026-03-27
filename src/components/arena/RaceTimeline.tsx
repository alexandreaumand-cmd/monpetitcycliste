import { useState } from "react";
import { Send, Clock, Mountain, Zap, AlertTriangle, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  time: string;
  type: string;
  title?: string;
  text: string;
  riders: string[];
}

interface RaceTimelineProps {
  events: TimelineEvent[];
  onBroadcast: (text: string) => void;
  disabled?: boolean;
  matchedRiders?: Record<string, { manager_name: string; rider_nom: string }>;
}

const typeConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  sprint: { icon: Zap, color: "text-green-600 bg-green-100 dark:bg-green-900/30", label: "Sprint" },
  climb: { icon: Mountain, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30", label: "Col" },
  crash: { icon: AlertTriangle, color: "text-red-600 bg-red-100 dark:bg-red-900/30", label: "Chute" },
  intermediate: { icon: Clock, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30", label: "Intermédiaire" },
  attack: { icon: Zap, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30", label: "Attaque" },
};

export const RaceTimeline = ({ events, onBroadcast, disabled, matchedRiders }: RaceTimelineProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Clock className="h-6 w-6 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun événement importé</p>
        <p className="text-xs mt-1">Importez une URL pour remplir la timeline</p>
      </div>
    );
  }

  const handleBroadcast = (index: number) => {
    if (editingIndex === index && editText) {
      onBroadcast(editText);
      setEditingIndex(null);
      setEditText("");
    } else {
      const event = events[index];
      const riderList = event.riders.length > 0 ? `\n${event.riders.slice(0, 5).join(", ")}` : "";
      onBroadcast(`${event.text}${riderList}`);
    }
  };

  return (
    <div className="space-y-2">
      {events.map((event, i) => {
        const config = typeConfig[event.type] || typeConfig.intermediate;
        const Icon = config.icon;
        const isEditing = editingIndex === i;

        return (
          <div
            key={i}
            className="flex items-start gap-2 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
          >
            {/* Timeline dot + time */}
            <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", config.color)}>
                <Icon className="h-3 w-3 mr-0.5" />
                {config.label}
              </Badge>
              {event.time && (
                <span className="text-[10px] text-muted-foreground">{event.time}</span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleBroadcast(i);
                    if (e.key === "Escape") { setEditingIndex(null); setEditText(""); }
                  }}
                />
              ) : (
                <div>
                  {event.title && (
                    <p className="text-xs font-semibold leading-snug">{event.title}</p>
                  )}
                  <p className="text-xs leading-relaxed text-muted-foreground">{event.text}</p>
                </div>
              )}
              {event.riders.length > 0 && !isEditing && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {event.riders.slice(0, 5).map((rider, ri) => (
                    <span key={ri} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {rider}
                    </span>
                  ))}
                  {event.riders.length > 5 && (
                    <span className="text-[10px] text-muted-foreground">+{event.riders.length - 5}</span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => {
                  if (isEditing) {
                    setEditingIndex(null);
                    setEditText("");
                  } else {
                    setEditingIndex(i);
                    const riderList = event.riders.length > 0 ? `\n${event.riders.slice(0, 5).join(", ")}` : "";
                    setEditText(`${event.text}${riderList}`);
                  }
                }}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => handleBroadcast(i)}
                disabled={disabled}
              >
                <Send className="h-3 w-3" />
                Diffuser
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

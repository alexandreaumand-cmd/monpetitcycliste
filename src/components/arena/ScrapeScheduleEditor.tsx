import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ScrapeWindow = {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
  intervalSec: number;
};

export const DEFAULT_SCHEDULE: ScrapeWindow[] = [
  { start: "11:00", end: "15:00", intervalSec: 1800 },
  { start: "15:00", end: "16:00", intervalSec: 300 },
  { start: "16:00", end: "17:30", intervalSec: 30 },
];

const formatInterval = (sec: number) => {
  if (sec < 60) return `${sec}s`;
  if (sec % 60 === 0) return `${sec / 60}min`;
  return `${Math.floor(sec / 60)}min${sec % 60}s`;
};

interface Props {
  schedule: ScrapeWindow[];
  onChange: (s: ScrapeWindow[]) => void;
  disabled?: boolean;
}

export const ScrapeScheduleEditor = ({ schedule, onChange, disabled }: Props) => {
  const update = (i: number, patch: Partial<ScrapeWindow>) => {
    const next = schedule.map((w, idx) => (idx === i ? { ...w, ...patch } : w));
    onChange(next);
  };
  const remove = (i: number) => onChange(schedule.filter((_, idx) => idx !== i));
  const add = () => onChange([...schedule, { start: "12:00", end: "13:00", intervalSec: 300 }]);

  return (
    <div className="space-y-1.5">
      {schedule.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Aucune plage horaire — l'auto-refresh ne se déclenchera pas.</p>
      )}
      {schedule.map((w, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">De</span>
          <Input
            type="time"
            value={w.start}
            onChange={(e) => update(i, { start: e.target.value })}
            className="h-7 w-[100px] text-xs"
            disabled={disabled}
          />
          <span className="text-muted-foreground">à</span>
          <Input
            type="time"
            value={w.end}
            onChange={(e) => update(i, { end: e.target.value })}
            className="h-7 w-[100px] text-xs"
            disabled={disabled}
          />
          <span className="text-muted-foreground ml-1">→ toutes les</span>
          <Input
            type="number"
            min={5}
            value={w.intervalSec}
            onChange={(e) => update(i, { intervalSec: Math.max(5, parseInt(e.target.value) || 5) })}
            className="h-7 w-[80px] text-xs"
            disabled={disabled}
          />
          <span className="text-muted-foreground">s</span>
          <span className="text-muted-foreground/70 ml-1">({formatInterval(w.intervalSec)})</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto"
            onClick={() => remove(i)}
            disabled={disabled}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={add}
        disabled={disabled}
        className="h-7 text-xs gap-1.5 text-muted-foreground"
      >
        <Plus className="h-3 w-3" /> Ajouter une plage
      </Button>
    </div>
  );
};

// Returns the matching window's interval (sec) for a given Date, or null if none matches.
export const getActiveInterval = (schedule: ScrapeWindow[], now: Date): number | null => {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  for (const w of schedule) {
    const start = toMin(w.start);
    const end = toMin(w.end);
    if (start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end) {
      return w.intervalSec;
    }
  }
  return null;
};

export const describeSchedule = (schedule: ScrapeWindow[]): string => {
  if (!schedule.length) return "Aucune plage";
  return schedule.map((w) => `${w.start}–${w.end}: ${formatInterval(w.intervalSec)}`).join(" • ");
};

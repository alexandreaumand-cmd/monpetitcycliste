import { Loader2, Link2, RefreshCw, Timer, TimerOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ScrapeScheduleEditor,
  describeSchedule,
  type ScrapeWindow,
} from "@/components/arena/ScrapeScheduleEditor";
import { format } from "date-fns";

interface LiveImportBarProps {
  scrapeUrl: string;
  onScrapeUrlChange: (v: string) => void;
  onImport: () => void;
  isScraping: boolean;
  autoScrapeEnabled: boolean;
  onToggleAuto: () => void;
  schedule: ScrapeWindow[];
  onScheduleChange: (s: ScrapeWindow[]) => void;
  lastAutoScrapeAt: Date | null;
  nextScrapeAt: Date | null;
  /** "HH:MM" (Paris) of the next window later today, when currently out of window */
  nextWindowStart?: string | null;
  /** Human label of the windows actually used (stage plan vs course-level) */
  scheduleSource?: string;
  scrapeStats: { total: number; matched: number; unmatched: string[] } | null;
  sticky?: boolean;
}

export const LiveImportBar = ({
  scrapeUrl,
  onScrapeUrlChange,
  onImport,
  isScraping,
  autoScrapeEnabled,
  onToggleAuto,
  schedule,
  onScheduleChange,
  lastAutoScrapeAt,
  nextScrapeAt,
  nextWindowStart,
  scheduleSource,
  scrapeStats,
  sticky,
}: LiveImportBarProps) => {
  return (
    <Card className={sticky ? "sticky top-0 z-30 shadow-sm" : ""}>
      <CardContent className="pt-3 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={scrapeUrl}
            onChange={(e) => onScrapeUrlChange(e.target.value)}
            placeholder="Coller une URL FirstCycling ou PCS…"
            className="h-9 text-sm flex-1 min-w-0"
            onKeyDown={(e) => e.key === "Enter" && onImport()}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onImport}
            disabled={isScraping || !scrapeUrl}
            className="h-9 gap-1.5 flex-1"
          >
            {isScraping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Importer
          </Button>
          <Button
            size="sm"
            variant={autoScrapeEnabled ? "default" : "outline"}
            onClick={onToggleAuto}
            className="h-9 gap-1.5 flex-1"
          >
            {autoScrapeEnabled ? (
              <Timer className="h-4 w-4 animate-pulse" />
            ) : (
              <TimerOff className="h-4 w-4" />
            )}
            {autoScrapeEnabled ? "Auto ON" : "Auto OFF"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0"
                title="Planning auto-scrape"
              >
                <Clock className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] space-y-2">
              <p className="text-xs font-semibold">Plages horaires de scraping</p>
              <p className="text-[10px] text-muted-foreground">
                Définissez la fréquence selon l'heure.
              </p>
              <ScrapeScheduleEditor
                schedule={schedule}
                onChange={onScheduleChange}
                disabled={autoScrapeEnabled}
              />
              {autoScrapeEnabled && (
                <p className="text-[10px] text-muted-foreground italic">
                  Désactivez l'auto pour modifier.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                Actuel : {describeSchedule(schedule)}
              </p>
            </PopoverContent>
          </Popover>
        </div>

        {(scrapeStats || autoScrapeEnabled) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {scrapeStats && (
              <span>
                <span className="text-foreground font-medium">
                  {scrapeStats.matched}/{scrapeStats.total}
                </span>{" "}
                coureurs matchés
              </span>
            )}
            {scrapeStats && scrapeStats.unmatched.length > 0 && (
              <span className="text-destructive">
                ⚠ {scrapeStats.unmatched.slice(0, 2).join(", ")}
                {scrapeStats.unmatched.length > 2 &&
                  ` +${scrapeStats.unmatched.length - 2}`}
              </span>
            )}
            {autoScrapeEnabled && (
              <span className="ml-auto text-primary flex items-center gap-2">
                {lastAutoScrapeAt && (
                  <span>⏱ {format(lastAutoScrapeAt, "HH:mm:ss")}</span>
                )}
                {nextScrapeAt ? (
                  <span>→ {format(nextScrapeAt, "HH:mm:ss")}</span>
                ) : nextWindowStart ? (
                  <span className="text-muted-foreground">
                    ⏸ Hors plage — reprise à {nextWindowStart}
                  </span>
                ) : (
                  <span className="text-muted-foreground">⏸ Terminé pour aujourd'hui</span>
                )}
              </span>
            )}
            {autoScrapeEnabled && scheduleSource && (
              <span className="w-full text-[10px] text-muted-foreground">
                Selon les {scheduleSource} (heure de Paris)
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

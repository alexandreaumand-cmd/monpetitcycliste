import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { differenceInHours, differenceInMinutes } from "date-fns";
import type { PronosticDeadline } from "@/hooks/useArenaPronostics";

interface Props {
  /** Open deadlines the manager has NOT filled yet */
  missing: PronosticDeadline[];
  onGoToUpcoming: () => void;
}

const countdown = (date: Date) => {
  const mins = differenceInMinutes(date, new Date());
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hrs = differenceInHours(date, new Date());
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}j`;
};

export const PronosticUrgencyBanner = ({ missing, onGoToUpcoming }: Props) => {
  const { t } = useTranslation("arena");
  if (missing.length === 0) return null;

  const sorted = [...missing].sort(
    (a, b) => new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime()
  );
  const next = sorted[0];
  const nextDate = new Date(next.deadline_at);
  const urgent = differenceInHours(nextDate, new Date()) < 24;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
        urgent
          ? "border-destructive/40 bg-destructive/5"
          : "border-primary/30 bg-primary/5"
      }`}
    >
      {urgent ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-primary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {t("pronostics.urgency.title", { count: missing.length })}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t("pronostics.urgency.next", {
            race: next.courses?.nom ?? "",
            time: countdown(nextDate),
          })}
        </p>
      </div>
      <Button size="sm" variant={urgent ? "destructive" : "default"} onClick={onGoToUpcoming} className="gap-1">
        {t("pronostics.urgency.cta")}
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

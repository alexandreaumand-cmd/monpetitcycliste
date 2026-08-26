import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { LiveStageState } from "@/hooks/useLiveStageStatus";

interface LiveStageBadgeProps {
  etape: number | null;
  state: LiveStageState;
  className?: string;
}

/** Stage badge that only claims "live" while inside a scheduled scrape window. */
export const LiveStageBadge = ({ etape, state, className }: LiveStageBadgeProps) => {
  const { t } = useTranslation("arena");
  if (etape == null) return null;

  const isLive = state === "live";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border whitespace-nowrap",
        isLive
          ? "text-destructive-foreground bg-destructive border-destructive"
          : "text-muted-foreground bg-muted border-border",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isLive ? "bg-destructive-foreground animate-pulse" : "bg-muted-foreground/60"

        )}
      />
      {t(`liveStage.${state}`, { etape })}
    </span>
  );
};

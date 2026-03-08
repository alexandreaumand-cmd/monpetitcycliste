import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Flag } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RaceGroup {
  name: string;
  riders: string[];
  riderCount: number;
  gap: string;
  isPeloton: boolean;
  riderIds?: string[];
}

interface RaceSituationDisplayProps {
  groups: RaceGroup[];
  kmRemaining: number;
  rosterOwners?: Record<string, string>;
}

/** Parse gap string like "+1:30" or "0:00" to total seconds */
function parseGapToSeconds(gap: string): number {
  const cleaned = gap.replace("+", "").trim();
  const parts = cleaned.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  }
  return 0;
}

export const RaceSituationDisplay = ({ groups, kmRemaining, rosterOwners }: RaceSituationDisplayProps) => {
  const positioned = useMemo(() => {
    if (groups.length === 0) return [];
    const gaps = groups.map((g) => parseGapToSeconds(g.gap));
    const maxGap = Math.max(...gaps, 1);

    return groups.map((g, i) => ({
      ...g,
      gapSeconds: gaps[i],
      position: maxGap > 0 ? gaps[i] / maxGap : 0,
    }));
  }, [groups]);

  const getBikeCount = (riderCount: number, isPeloton: boolean) => {
    if (isPeloton) return 4;
    if (riderCount >= 20) return 3;
    if (riderCount >= 5) return 2;
    return 1;
  };

  return (
    <div className="w-full space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span>🏁 {kmRemaining} km</span>
      </div>

      {/* Road visualization */}
      <div className="relative w-full h-auto min-h-[80px]">
        {/* Road surface */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-3 bg-muted/60 rounded-full border border-border/50" />

        {/* Finish flag on right */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10">
          <Flag className="h-4 w-4 text-foreground" />
        </div>

        {/* Groups */}
        <TooltipProvider delayDuration={200}>
          <div className="relative w-full flex items-center justify-end gap-0" style={{ minHeight: 80 }}>
            {positioned.map((group, i) => {
              const bikeCount = getBikeCount(group.riderCount, group.isPeloton);
              const rightPercent = 8 + group.position * 78;

              // Build rider display with manager names
              const riderDisplayItems = group.riders.map((riderName, ri) => {
                const riderId = group.riderIds?.[ri];
                const ownerName = riderId && rosterOwners?.[riderId];
                return { riderName, ownerName };
              });

              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute flex flex-col items-center gap-0.5 cursor-default"
                      style={{
                        right: `${rightPercent}%`,
                        top: "50%",
                        transform: "translate(50%, -50%)",
                      }}
                    >
                      {/* Group label + gap */}
                      <div className="flex flex-col items-center mb-1">
                        <span
                          className={cn(
                            "text-[9px] font-semibold leading-tight whitespace-nowrap",
                            group.isPeloton ? "text-primary" : "text-foreground"
                          )}
                        >
                          {group.name}
                        </span>
                        {group.gap !== "0:00" && (
                          <span className="text-[8px] text-muted-foreground leading-tight">
                            {group.gap.startsWith("+") ? group.gap : `+${group.gap}`}
                          </span>
                        )}
                      </div>

                      {/* Bikes — flipped to face right (toward finish) */}
                      <div className="flex items-center">
                        {Array.from({ length: bikeCount }).map((_, j) => (
                          <span
                            key={j}
                            className={cn(
                              "leading-none",
                              group.isPeloton ? "text-sm" : "text-xs"
                            )}
                            style={{ marginLeft: j > 0 ? -2 : 0, transform: "scaleX(-1)" }}
                          >
                            🚴
                          </span>
                        ))}
                      </div>

                      {/* Rider count */}
                      <span
                        className={cn(
                          "text-[8px] leading-tight mt-0.5",
                          group.isPeloton
                            ? "font-semibold text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        {group.riderCount} crs
                      </span>

                      {/* Rider names with managers (show max 3 inline) */}
                      {riderDisplayItems.length > 0 && (
                        <div className="flex flex-col items-center mt-0.5 max-w-[120px]">
                          {riderDisplayItems.slice(0, 3).map((item, ri) => (
                            <span key={ri} className="text-[8px] leading-tight whitespace-nowrap truncate max-w-full">
                              <span className="font-medium text-foreground">{item.riderName}</span>
                              {item.ownerName && (
                                <span className="text-muted-foreground"> ({item.ownerName})</span>
                              )}
                            </span>
                          ))}
                          {riderDisplayItems.length > 3 && (
                            <span className="text-[7px] text-muted-foreground">
                              +{riderDisplayItems.length - 3} autres
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  {group.riders.length > 0 && (
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="text-xs font-semibold mb-1">{group.name}</p>
                      <ul className="text-[11px] space-y-0.5">
                        {riderDisplayItems.map((item, ri) => (
                          <li key={ri}>
                            • {item.riderName}
                            {item.ownerName && (
                              <span className="text-muted-foreground"> ({item.ownerName})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {group.riderCount > group.riders.length && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          +{group.riderCount - group.riders.length} autres
                        </p>
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
};

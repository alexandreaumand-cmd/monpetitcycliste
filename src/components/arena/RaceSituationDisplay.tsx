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
}

interface RaceSituationDisplayProps {
  groups: RaceGroup[];
  kmRemaining: number;
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

export const RaceSituationDisplay = ({ groups, kmRemaining }: RaceSituationDisplayProps) => {
  // Compute positions: 0% = head of race (right), 100% = furthest behind (left)
  const positioned = useMemo(() => {
    if (groups.length === 0) return [];
    const gaps = groups.map((g) => parseGapToSeconds(g.gap));
    const maxGap = Math.max(...gaps, 1);

    return groups.map((g, i) => ({
      ...g,
      gapSeconds: gaps[i],
      // Position 0 = head (right), 1 = tail (left)
      position: maxGap > 0 ? gaps[i] / maxGap : 0,
    }));
  }, [groups]);

  // Bike count scaled: min 1, max 4 bikes
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
              // Position from right: 0% = at the flag, towards left based on gap
              // Leave 8% margin on right for flag, 4% on left
              const rightPercent = 8 + group.position * 78;

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

                      {/* Bikes */}
                      <div className="flex items-center">
                        {Array.from({ length: bikeCount }).map((_, j) => (
                          <span
                            key={j}
                            className={cn(
                              "leading-none",
                              group.isPeloton ? "text-sm" : "text-xs"
                            )}
                            style={{ marginLeft: j > 0 ? -2 : 0 }}
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
                    </div>
                  </TooltipTrigger>
                  {group.riders.length > 0 && (
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="text-xs font-semibold mb-1">{group.name}</p>
                      <ul className="text-[11px] space-y-0.5">
                        {group.riders.map((r, ri) => (
                          <li key={ri}>• {r}</li>
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

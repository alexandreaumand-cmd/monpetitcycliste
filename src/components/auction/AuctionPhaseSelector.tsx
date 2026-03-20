import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AuctionPhaseInfo } from "@/hooks/useLeagueAuctionPhases";
import { useState } from "react";

interface AuctionPhaseSelectorProps {
  phases: AuctionPhaseInfo[];
  selectedPhaseId: string;
  onPhaseChange: (phaseId: string) => void;
  compact?: boolean;
}

export function AuctionPhaseSelector({
  phases,
  selectedPhaseId,
  onPhaseChange,
  compact = false,
}: AuctionPhaseSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = phases.find((p) => p.phaseId === selectedPhaseId);

  if (phases.length <= 1) return null;

  // Group by season
  const bySeason = phases.reduce((acc, p) => {
    if (!acc[p.seasonYear]) acc[p.seasonYear] = [];
    acc[p.seasonYear].push(p);
    return acc;
  }, {} as Record<number, AuctionPhaseInfo[]>);

  const seasons = Object.keys(bySeason)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className="gap-1.5 font-medium"
        >
          {selected
            ? `Phase ${selected.phaseIndex}`
            : "Phase"}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        {seasons.map((year) => (
          <div key={year}>
            {seasons.length > 1 && (
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Saison {year}
              </div>
            )}
            {bySeason[year]
              .sort((a, b) => b.phaseIndex - a.phaseIndex)
              .map((phase) => {
                const isSelected = phase.phaseId === selectedPhaseId;
                return (
                  <button
                    key={phase.phaseId}
                    onClick={() => {
                      onPhaseChange(phase.phaseId);
                      setOpen(false);
                    }}
                    className={`
                      w-full text-left px-3 py-2 rounded-md text-sm
                      transition-colors flex items-center justify-between
                      ${isSelected
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted"
                      }
                    `}
                  >
                    <span>Phase {phase.phaseIndex}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

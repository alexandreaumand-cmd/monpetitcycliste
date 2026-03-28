import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface RaceGroup {
  name: string;
  riders: string[];
  riderCount: number;
  gap: string;
  isPeloton: boolean;
  riderIds?: string[];
  riderBibs?: string[];
  riderGcGaps?: string[];
}

interface RaceSituationDisplayProps {
  groups: RaceGroup[];
  kmRemaining: number;
  rosterOwners?: Record<string, string>;
}

export const RaceSituationDisplay = ({ groups, kmRemaining, rosterOwners }: RaceSituationDisplayProps) => {
  if (groups.length === 0) return null;

  return (
    <div className="w-full space-y-0">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground px-1 pb-1.5 border-b border-border/50">
        <span>🏁</span>
        <span>{kmRemaining} km restants</span>
      </div>

      {/* Groups */}
      {groups.map((group, i) => (
        <GroupRow
          key={i}
          group={group}
          index={i + 1}
          rosterOwners={rosterOwners}
        />
      ))}
    </div>
  );
};

function GroupRow({
  group,
  index,
  rosterOwners,
}: {
  group: RaceGroup;
  index: number;
  rosterOwners?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const badgeLabel = group.isPeloton ? "P" : String(index);
  const gapDisplay = group.gap === "0:00" ? "" : (group.gap.startsWith("+") ? group.gap : `+${group.gap}`);

  const riderItems = group.riders.map((name, ri) => {
    const riderId = group.riderIds?.[ri];
    const ownerName = riderId && rosterOwners?.[riderId];
    const bib = group.riderBibs?.[ri];
    const gcGap = group.riderGcGaps?.[ri];
    return { name, ownerName, bib, gcGap };
  });

  const showRiders = !group.isPeloton && riderItems.length > 0;
  const showCollapsible = riderItems.length > 5;
  const visibleRiders = showCollapsible ? riderItems.slice(0, 5) : riderItems;
  const hiddenRiders = showCollapsible ? riderItems.slice(5) : [];

  return (
    <div className="flex gap-2 py-1.5 border-b border-border/30 last:border-b-0 px-1">
      {/* Left column: badge + gap */}
      <div className="flex flex-col items-center w-8 flex-shrink-0 pt-0.5">
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
            group.isPeloton
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground border border-border"
          )}
        >
          {badgeLabel}
        </div>
        {gapDisplay && (
          <span className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-tight">
            {gapDisplay}
          </span>
        )}
      </div>

      {/* Right column: group name + riders */}
      <div className="flex-1 min-w-0">
        {/* Group name label */}
        {group.name && (
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
            {group.name}
          </div>
        )}

        {/* Peloton: just show count */}
        {group.isPeloton && (
          <div className="text-[11px] text-muted-foreground">
            {group.riderCount} coureurs
          </div>
        )}

        {/* Rider list */}
        {showRiders && (
          <div className="space-y-0">
            {visibleRiders.map((item, ri) => (
              <RiderRow key={ri} rank={ri + 1} name={item.name} ownerName={item.ownerName} />
            ))}

            {showCollapsible && (
              <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleContent className="space-y-0">
                  {hiddenRiders.map((item, ri) => (
                    <RiderRow key={ri} rank={visibleRiders.length + ri + 1} name={item.name} ownerName={item.ownerName} />
                  ))}
                </CollapsibleContent>
                <CollapsibleTrigger className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
                  {open ? "Réduire" : `+${hiddenRiders.length} autres`}
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RiderRow({ rank, name, ownerName }: { rank: number; name: string; ownerName?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] leading-relaxed">
      <span className="w-3 text-right text-[10px] text-muted-foreground flex-shrink-0">{rank}</span>
      <span className={cn(
        "truncate",
        ownerName ? "font-medium text-primary" : "text-foreground"
      )}>
        {name}
      </span>
      {ownerName && (
        <span className="text-[9px] text-muted-foreground flex-shrink-0">
          ({ownerName})
        </span>
      )}
    </div>
  );
}

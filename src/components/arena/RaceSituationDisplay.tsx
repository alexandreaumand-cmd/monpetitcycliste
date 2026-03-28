import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
}

interface RaceSituationDisplayProps {
  groups: RaceGroup[];
  kmRemaining: number;
  rosterOwners?: Record<string, string>;
}

export const RaceSituationDisplay = ({ groups, kmRemaining, rosterOwners }: RaceSituationDisplayProps) => {
  if (groups.length === 0) return null;

  return (
    <div className="w-full space-y-1">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground px-1 pb-1 border-b border-border/50">
        <span>🏁</span>
        <span>{kmRemaining} km restants</span>
      </div>

      {/* Groups list */}
      <div className="space-y-0">
        {groups.map((group, i) => (
          <GroupRow
            key={i}
            group={group}
            index={i + 1}
            rosterOwners={rosterOwners}
          />
        ))}
      </div>
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
    return { name, ownerName };
  });

  const hasRiders = riderItems.length > 0;
  const showCollapsible = riderItems.length > 3;
  const visibleRiders = showCollapsible ? riderItems.slice(0, 3) : riderItems;
  const hiddenRiders = showCollapsible ? riderItems.slice(3) : [];

  return (
    <div className="py-1.5 border-b border-border/30 last:border-b-0">
      {/* Group header row */}
      <div className="flex items-center gap-2 px-1">
        {/* Badge */}
        <div
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
            group.isPeloton
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground border border-border"
          )}
        >
          {badgeLabel}
        </div>

        {/* Name + count */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-xs font-semibold truncate",
              group.isPeloton ? "text-primary" : "text-foreground"
            )}>
              {group.name || `Groupe ${index}`}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              ({group.riderCount} crs)
            </span>
          </div>
        </div>

        {/* Gap */}
        {gapDisplay && (
          <span className="text-[11px] font-mono font-medium text-muted-foreground flex-shrink-0">
            {gapDisplay}
          </span>
        )}
      </div>

      {/* Riders list */}
      {hasRiders && (
        <div className="ml-9 mt-1 pl-2 border-l-2 border-border/40 space-y-0.5">
          {visibleRiders.map((item, ri) => (
            <RiderRow key={ri} name={item.name} ownerName={item.ownerName} />
          ))}

          {showCollapsible && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleContent className="space-y-0.5">
                {hiddenRiders.map((item, ri) => (
                  <RiderRow key={ri} name={item.name} ownerName={item.ownerName} />
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
  );
}

function RiderRow({ name, ownerName }: { name: string; ownerName?: string }) {
  return (
    <div className="flex items-center gap-1 text-[11px] leading-tight">
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

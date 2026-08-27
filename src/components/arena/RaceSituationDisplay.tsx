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
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground px-1 pb-2 border-b border-border/50">
        <span>🏁</span>
        <span>{kmRemaining} km restants</span>
      </div>

      {/* Groups with gap separators */}
      {groups.map((group, i) => (
        <div key={i}>
          {/* Gap separator between groups */}
          {i > 0 && group.gap && group.gap !== "0:00" && (
            <GapSeparator gap={group.gap.startsWith("+") ? group.gap : `+${group.gap}`} />
          )}

          <GroupRow
            group={group}
            index={i + 1}
            rosterOwners={rosterOwners}
          />
        </div>
      ))}
    </div>
  );
};

function GapSeparator({ gap }: { gap: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-sm font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
        {gap}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

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

  const riderItems = group.riders
    .map((name, ri) => {
      const riderId = group.riderIds?.[ri];
      const ownerName = riderId ? rosterOwners?.[riderId] : undefined;
      const bib = group.riderBibs?.[ri];
      const gcGap = group.riderGcGaps?.[ri];
      return { name, ownerName, bib, gcGap };
    })
    .sort((a, b) => {
      // Riders with an owner first, sorted by manager name; unowned riders last, sorted by rider name
      if (a.ownerName && !b.ownerName) return -1;
      if (!a.ownerName && b.ownerName) return 1;
      if (a.ownerName && b.ownerName) {
        const cmp = a.ownerName.localeCompare(b.ownerName, "fr", { sensitivity: "base" });
        if (cmp !== 0) return cmp;
      }
      return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
    });

  const showRiders = riderItems.length > 0;
  const showCollapsible = riderItems.length > 10;
  const visibleRiders = showCollapsible ? riderItems.slice(0, 10) : riderItems;
  const hiddenRiders = showCollapsible ? riderItems.slice(10) : [];

  return (
    <div className="flex gap-2 py-2 px-1">
      {/* Left column: badge + rider count */}
      <div className="flex flex-col items-center w-10 flex-shrink-0 pt-0.5">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            group.isPeloton
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground border border-border"
          )}
        >
          {badgeLabel}
        </div>
        {!group.isPeloton && (
          <span className="text-xs text-muted-foreground mt-0.5 leading-tight">
            ({group.riderCount || group.riders.length})
          </span>
        )}
      </div>

      {/* Right column: group name + riders */}
      <div className="flex-1 min-w-0">
        {/* Group name label */}
        {group.name && (
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
            {group.name}
          </div>
        )}

        {/* Peloton: show label + count */}

        {/* Rider list */}
        {showRiders && (
          <div className="space-y-0">
            {visibleRiders.map((item, ri) => (
              <RiderRow key={ri} rank={ri + 1} name={item.name} ownerName={item.ownerName} bib={item.bib} gcGap={item.gcGap} />
            ))}

            {showCollapsible && (
              <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleContent className="space-y-0">
                  {hiddenRiders.map((item, ri) => (
                    <RiderRow key={ri} rank={visibleRiders.length + ri + 1} name={item.name} ownerName={item.ownerName} bib={item.bib} gcGap={item.gcGap} />
                  ))}
                </CollapsibleContent>
                <CollapsibleTrigger className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
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

function RiderRow({ rank, name, ownerName, bib, gcGap }: { rank: number; name: string; ownerName?: string; bib?: string; gcGap?: string }) {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 text-sm leading-relaxed min-w-0 overflow-hidden">
      <span className="w-4 text-right text-xs text-muted-foreground flex-shrink-0">{rank}</span>
      {bib && (
        <span className="w-6 text-right text-xs text-muted-foreground/60 flex-shrink-0">{bib}</span>
      )}
      <span className={cn(
        "truncate",
        ownerName ? "font-medium text-primary" : "text-foreground"
      )}>
        {name}
      </span>
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {ownerName ? `(${ownerName})` : "(-)"}
      </span>
      {gcGap && (
        <span className="text-xs font-mono text-muted-foreground flex-shrink-0 ml-auto">
          {gcGap}
        </span>
      )}
    </div>
  );
}

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { Button } from "@/components/ui/button";
import { LeagueSwitcherBottomSheet } from "./LeagueSwitcherBottomSheet";

export function LeagueSwitcherHeaderMobile() {
  const { leagueId } = useLeague();
  const { leagues, isLoading } = useUserLeagues();
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  const currentLeague = leagues.find(l => l.id === leagueId);

  if (isLoading || !currentLeague) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs font-medium truncate max-w-[140px]"
        onClick={() => setBottomSheetOpen(true)}
      >
        <span className="truncate">{currentLeague.name}</span>
        <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
      </Button>

      <LeagueSwitcherBottomSheet
        open={bottomSheetOpen}
        onOpenChange={setBottomSheetOpen}
      />
    </>
  );
}

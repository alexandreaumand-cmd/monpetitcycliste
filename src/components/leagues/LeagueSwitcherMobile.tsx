import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { Badge } from "@/components/ui/badge";
import { LeagueSwitcherBottomSheet } from "./LeagueSwitcherBottomSheet";

export function LeagueSwitcherMobile() {
  const { leagueId } = useLeague();
  const { leagues, roles, isLoading } = useUserLeagues();
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  const currentLeague = leagues.find(l => l.id === leagueId);

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b">
        <div className="text-sm text-muted-foreground animate-pulse">
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className="w-full px-4 py-3 border-b flex items-center justify-between hover:bg-accent/50 transition-colors touch-target"
        onClick={() => setBottomSheetOpen(true)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium shrink-0">🏆</span>
          <span className="text-sm truncate">
            {currentLeague?.name || "Aucune ligue"}
          </span>
          {currentLeague && (
            <Badge variant="outline" className="shrink-0">
              {roles[leagueId!] === 'owner' && '👑'}
              {roles[leagueId!] === 'admin' && '⚙️'}
              {roles[leagueId!] === 'member' && '👤'}
            </Badge>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <LeagueSwitcherBottomSheet
        open={bottomSheetOpen}
        onOpenChange={setBottomSheetOpen}
      />
    </>
  );
}

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { useLeagueSeason } from "@/hooks/useLeagueSeason";
import { Badge } from "@/components/ui/badge";
import { LeagueSwitcherBottomSheet } from "./LeagueSwitcherBottomSheet";
import type { GameMode } from "@/lib/leagues/types";

const formatGameMode = (mode: GameMode | undefined): string => {
  if (!mode) return '';
  switch(mode) {
    case 'short_wt': return 'WT';
    case 'short_gt': return 'GT';
    case 'short_classics': return 'Classiques';
    case 'full_season': return 'Saison complète';
    default: return '';
  }
};

export function LeagueSwitcherMobile() {
  const { leagueId } = useLeague();
  const { leagues, roles, isLoading } = useUserLeagues();
  const { data: leagueSeason } = useLeagueSeason(leagueId);
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
        className="w-full px-4 py-3 border-b hover:bg-accent/50 transition-colors touch-target"
        onClick={() => setBottomSheetOpen(true)}
      >
        <div className="flex items-start justify-between w-full gap-2">
          <div className="flex-1 min-w-0">
            {/* Ligne 1 : Ligue + Badge */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium shrink-0">🏆</span>
              <span className="text-sm truncate">
                {currentLeague?.name || "Aucune ligue"}
              </span>
              {currentLeague && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  {roles[leagueId!] === 'owner' && '👑'}
                  {roles[leagueId!] === 'admin' && '⚙️'}
                  {roles[leagueId!] === 'member' && '👤'}
                </Badge>
              )}
            </div>
            
            {/* Ligne 2 : Saison / Mode */}
            {currentLeague && leagueSeason?.season && (
              <div className="text-xs text-muted-foreground pl-6">
                {leagueSeason.season.annee} / {formatGameMode(currentLeague.game_mode)}
              </div>
            )}
          </div>
          
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        </div>
      </button>

      <LeagueSwitcherBottomSheet
        open={bottomSheetOpen}
        onOpenChange={setBottomSheetOpen}
      />
    </>
  );
}

import { useState } from "react";
import { ChevronDown, Plus, Users, Trophy, Calendar } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { CreateLeagueDialog } from "./CreateLeagueDialog";
import { JoinLeagueDialog } from "./JoinLeagueDialog";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getLeagueTemplates } from "@/lib/leagues/templates";

export function LeagueSwitcher() {
  const { t } = useTranslation('leagues');
  const { leagueId, setLeagueId } = useLeague();
  const { leagues, roles, isLoading } = useUserLeagues();
  const { selectedSeason } = useSeasonContext();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ['league-templates'],
    queryFn: getLeagueTemplates,
  });

  const currentLeague = leagues.find(l => l.id === leagueId);
  const gameModeTemplate = currentLeague?.game_mode 
    ? templates?.find(t => t.id === currentLeague.game_mode) 
    : null;

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <span className="animate-pulse">{t('switcher.loading')}</span>
      </Button>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline font-medium text-sm">
                    {currentLeague?.name || t('switcher.selectLeague')}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuLabel>{t('switcher.myLeagues')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {leagues.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t('switcher.noLeagues')}
            </div>
          ) : (
            leagues.map(league => (
              <DropdownMenuItem
                key={league.id}
                onClick={() => setLeagueId(league.id)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{league.name}</span>
                  {league.id === leagueId && (
                    <Badge className="w-fit text-xs bg-[#FFF4CC] text-foreground border border-[hsl(var(--bordure-gold))] font-semibold">{t('switcher.current')}</Badge>
                  )}
                </div>
                <Badge variant="outline" className="ml-2">
                  {roles[league.id] === 'owner' && '👑'}
                  {roles[league.id] === 'admin' && '⚙️'}
                  {roles[league.id] === 'member' && '👤'}
                </Badge>
              </DropdownMenuItem>
            ))
          )}

          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('switcher.createLeague')}
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => setJoinDialogOpen(true)}
            className="cursor-pointer"
          >
            <Users className="mr-2 h-4 w-4" />
            {t('switcher.joinLeague')}
          </DropdownMenuItem>
        </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </TooltipTrigger>
        {currentLeague && (gameModeTemplate || selectedSeason) && (
          <TooltipContent side="bottom" className="flex items-center gap-2">
            {gameModeTemplate && (
              <>
                <Trophy className="h-3 w-3" />
                <span>{gameModeTemplate.name}</span>
              </>
            )}
            {gameModeTemplate && selectedSeason && <span>•</span>}
            {selectedSeason && (
              <>
                <Calendar className="h-3 w-3" />
                <span>{selectedSeason.annee}</span>
              </>
            )}
          </TooltipContent>
        )}
      </Tooltip>

      <CreateLeagueDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <JoinLeagueDialog
        open={joinDialogOpen}
        onOpenChange={setJoinDialogOpen}
      />
    </>
  );
}

import { useState } from "react";
import { ChevronDown, Plus, Users } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { CreateLeagueDialog } from "./CreateLeagueDialog";
import { JoinLeagueDialog } from "./JoinLeagueDialog";

export function LeagueSwitcher() {
  const { leagueId, setLeagueId, isLegacy } = useLeague();
  const { leagues, roles, isLoading } = useUserLeagues();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  const currentLeague = leagues.find(l => l.id === leagueId);

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <span className="animate-pulse">Chargement...</span>
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">
              {currentLeague?.name || "Sélectionner une ligue"}
            </span>
            {isLegacy && <Badge className="ml-1 hidden md:inline-flex bg-[#FFF4CC] text-black border border-[#FFD500] font-semibold">Actuelle</Badge>}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[280px]">
          <DropdownMenuLabel>Mes ligues</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {leagues.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Aucune ligue
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
                    <Badge className="w-fit text-xs bg-[#FFF4CC] text-black border border-[#FFD500] font-semibold">Actuelle</Badge>
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
            Créer une ligue
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => setJoinDialogOpen(true)}
            className="cursor-pointer"
          >
            <Users className="mr-2 h-4 w-4" />
            Rejoindre une ligue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

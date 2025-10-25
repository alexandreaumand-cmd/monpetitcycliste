import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateLeagueDialog } from "./CreateLeagueDialog";
import { JoinLeagueDialog } from "./JoinLeagueDialog";
import { cn } from "@/lib/utils";

export function LeagueSwitcherMobile() {
  const { leagueId, setLeagueId } = useLeague();
  const { leagues, roles, isLoading } = useUserLeagues();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  const currentLeague = leagues.find(l => l.id === leagueId);

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b">
        <div className="text-sm text-muted-foreground animate-pulse">
          Chargement des ligues...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-3 border-b">
        <label className="text-sm font-medium block mb-2">Ligue</label>
        
        {leagues.length === 0 ? (
          <div className="text-sm text-muted-foreground mb-3">
            Aucune ligue
          </div>
        ) : (
          <div className="space-y-1 mb-3">
            {leagues.map(league => (
              <Button
                key={league.id}
                variant={league.id === leagueId ? "default" : "ghost"}
                className={cn(
                  "w-full justify-between touch-target",
                  league.id === leagueId && "shadow-sm"
                )}
                onClick={() => setLeagueId(league.id)}
              >
                <span className="truncate">{league.name}</span>
                <Badge variant="outline" className="ml-2 shrink-0">
                  {roles[league.id] === 'owner' && '👑'}
                  {roles[league.id] === 'admin' && '⚙️'}
                  {roles[league.id] === 'member' && '👤'}
                </Badge>
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-1">
          <Button
            variant="outline"
            className="w-full justify-start touch-target"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Créer une ligue
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start touch-target"
            onClick={() => setJoinDialogOpen(true)}
          >
            <Users className="mr-2 h-4 w-4" />
            Rejoindre une ligue
          </Button>
        </div>
      </div>

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

import { useState } from "react";
import { Plus, Users, Check } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { CreateLeagueDialog } from "./CreateLeagueDialog";
import { JoinLeagueDialog } from "./JoinLeagueDialog";
import { cn } from "@/lib/utils";

interface LeagueSwitcherBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeagueSwitcherBottomSheet({
  open,
  onOpenChange,
}: LeagueSwitcherBottomSheetProps) {
  const { leagueId, setLeagueId } = useLeague();
  const { leagues, roles, isLoading } = useUserLeagues();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  const handleLeagueSelect = (id: string) => {
    setLeagueId(id);
    onOpenChange(false);
  };

  return (
    <>
      <MobileBottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Changer de ligue"
        description="Sélectionnez une ligue ou créez-en une nouvelle"
      >
        {isLoading ? (
          <div className="text-sm text-muted-foreground animate-pulse py-4">
            Chargement des ligues...
          </div>
        ) : leagues.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            Aucune ligue disponible
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {leagues.map(league => (
              <Button
                key={league.id}
                variant={league.id === leagueId ? "default" : "outline"}
                className={cn(
                  "w-full justify-between h-auto py-3 touch-target",
                  league.id === leagueId && "shadow-sm"
                )}
                onClick={() => handleLeagueSelect(league.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {league.id === leagueId && <Check className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{league.name}</span>
                </div>
                <Badge variant="outline" className="ml-2 shrink-0">
                  {roles[league.id] === 'owner' && '👑'}
                  {roles[league.id] === 'admin' && '⚙️'}
                  {roles[league.id] === 'member' && '👤'}
                </Badge>
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-4 border-t">
          <Button
            variant="outline"
            className="w-full justify-start touch-target"
            onClick={() => {
              onOpenChange(false);
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Créer une ligue
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start touch-target"
            onClick={() => {
              onOpenChange(false);
              setJoinDialogOpen(true);
            }}
          >
            <Users className="mr-2 h-4 w-4" />
            Rejoindre une ligue
          </Button>
        </div>
      </MobileBottomSheet>

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

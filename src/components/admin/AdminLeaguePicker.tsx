import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AdminLeaguePicker() {
  const navigate = useNavigate();
  const { leagues, roles, isLoading } = useUserLeagues();
  const { leagueId } = useLeague();
  const [selected, setSelected] = useState<string>(leagueId ?? "");

  useEffect(() => {
    if (leagueId) setSelected(leagueId);
  }, [leagueId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Admin ligue :</span>
        <div className="h-10 w-64 animate-pulse bg-muted rounded-md" />
      </div>
    );
  }

  const adminLeagues = leagues.filter((l) =>
    ["owner", "admin"].includes(roles[l.id])
  );

  if (adminLeagues.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          Vous n'êtes administrateur d'aucune ligue.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <span className="text-sm text-muted-foreground">Admin ligue :</span>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Sélectionner une ligue" />
          </SelectTrigger>
          <SelectContent>
            {adminLeagues.map((league) => (
              <SelectItem key={league.id} value={league.id}>
                <div className="flex items-center gap-2">
                  {league.name}
                  {roles[league.id] === "owner" && (
                    <Badge variant="secondary" className="text-xs">
                      👑 Owner
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <Button
            onClick={() => navigate(`/dashboard/admin/leagues/${selected}`)}
            size="sm"
          >
            Ouvrir
          </Button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  leagueId: string;
  gameMode: string;
}

type Phase = {
  id: string;
  index_dans_saison: number;
  nom: string | null;
};

export function SuperAdminLeagueStandings({ leagueId, gameMode }: Props) {
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [scope, setScope] = useState<"season" | string>("season");

  // Load league scope (season + allowed phases)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: scopeData } = await supabase
        .from("league_scopes")
        .select("season_id, phases")
        .eq("league_id", leagueId)
        .maybeSingle();
      if (cancelled || !scopeData?.season_id) return;
      setSeasonId(scopeData.season_id);

      if (gameMode === "five_phases") {
        const phaseIds = (scopeData.phases as string[] | null) ?? [];
        if (phaseIds.length > 0) {
          const { data: phasesData } = await supabase
            .from("phases")
            .select("id, index_dans_saison, nom")
            .in("id", phaseIds)
            .order("index_dans_saison", { ascending: true });
          if (!cancelled) setPhases((phasesData ?? []) as Phase[]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId, gameMode]);

  const isPhase = scope !== "season";

  const { data: standings, isLoading } = useQuery({
    queryKey: ["super-admin-league-standings", leagueId, scope, seasonId],
    enabled: !!leagueId && (isPhase || !!seasonId),
    queryFn: async () => {
      if (isPhase) {
        const { data, error } = await supabase
          .from("v_manager_standings_by_phase_v2")
          .select("*")
          .eq("league_id", leagueId)
          .eq("phase_id", scope)
          .order("total_points", { ascending: false });
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase
        .from("v_manager_standings_by_season_v2")
        .select("*")
        .eq("league_id", leagueId)
        .eq("saison_id", seasonId!)
        .order("total_points", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Classement des managers
          </CardTitle>
          {gameMode === "five_phases" && phases.length > 0 && (
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="season">Saison entière</SelectItem>
                {phases.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    Phase {p.index_dans_saison}
                    {p.nom ? ` — ${p.nom}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !standings || standings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucun classement disponible pour ce périmètre.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Points coureurs</TableHead>
                <TableHead className="text-right">Bonus coureurs</TableHead>
                <TableHead className="text-right">Bonus manager</TableHead>
                <TableHead className="text-right">Victoires</TableHead>
                <TableHead className="text-right font-semibold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((row: any, idx: number) => (
                <TableRow key={row.manager_id ?? idx}>
                  <TableCell>
                    {idx === 0 ? (
                      <Badge className="bg-amber-500 hover:bg-amber-500 text-white">1</Badge>
                    ) : (
                      <span className="text-muted-foreground">{idx + 1}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{row.manager_nom ?? "—"}</TableCell>
                  <TableCell className="text-right">{row.total_race_pts ?? 0}</TableCell>
                  <TableCell className="text-right">{row.rider_bonus ?? 0}</TableCell>
                  <TableCell className="text-right">{row.manager_bonus ?? 0}</TableCell>
                  <TableCell className="text-right">{row.nb_victoires ?? 0}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {row.total_points ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

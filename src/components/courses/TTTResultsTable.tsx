import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

// Barème officiel TTT par position (1.1 category)
const TTT_BAREME = [100, 80, 65, 50, 40, 30, 20, 15, 10, 5];

interface TTTResultRow {
  race_result_id: string;
  row_position: number | null;
  position_decimal: number | null;
  statut: string;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  equipe_id_uci?: string | null;
  equipe_nom_uci?: string | null;
  manager_id: string | null;
  manager_nom: string | null;
  points_officiels: number | null;
  points_theoriques: number;
  is_my_rider: boolean;
}

interface TeamGroup {
  teamPosition: number;
  teamName: string;
  equipeIdUci: string;
  baremePoints: number;
  riders: TTTResultRow[];
  hasMyRider: boolean;
}

interface TTTResultsTableProps {
  results: TTTResultRow[];
  compact?: boolean;
}

export const TTTResultsTable = ({ results, compact = false }: TTTResultsTableProps) => {
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  // Group results by team and sort properly
  const groupedTeams: TeamGroup[] = (() => {
    const teamMap = new Map<string, TeamGroup>();

    results.forEach((row) => {
      if (row.position_decimal === null) return;
      
      const teamPosition = Math.floor(row.position_decimal);
      const teamKey = `${teamPosition}-${row.equipe_id_uci || row.equipe}`;
      
      if (!teamMap.has(teamKey)) {
        // Use barème points for team (0-indexed, so position 1 = index 0)
        const baremePoints = TTT_BAREME[teamPosition - 1] || 0;
        
        teamMap.set(teamKey, {
          teamPosition,
          teamName: row.equipe_nom_uci || row.equipe || 'Équipe inconnue',
          equipeIdUci: row.equipe_id_uci || row.equipe || '',
          baremePoints,
          riders: [],
          hasMyRider: false
        });
      }
      
      const team = teamMap.get(teamKey)!;
      team.riders.push(row);
      if (row.is_my_rider) {
        team.hasMyRider = true;
      }
    });

    // Sort teams by position, then sort riders within each team by position_decimal
    return Array.from(teamMap.values())
      .sort((a, b) => a.teamPosition - b.teamPosition)
      .map(team => ({
        ...team,
        riders: team.riders.sort((a, b) => (a.position_decimal || 0) - (b.position_decimal || 0))
      }));
  })();

  const toggleTeam = (teamKey: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamKey)) {
        newSet.delete(teamKey);
      } else {
        newSet.add(teamKey);
      }
      return newSet;
    });
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, { label: string; variant: "destructive" | "secondary" | "outline" }> = {
      dnf: { label: "DNF", variant: "destructive" },
      dns: { label: "DNS", variant: "secondary" },
      dsq: { label: "DSQ", variant: "outline" }
    };
    return variants[statut.toLowerCase()] || null;
  };

  const cellPadding = compact ? "px-1 py-1" : "px-2 py-2";
  const fontSize = compact ? "text-[11px]" : "text-xs sm:text-sm";

  return (
    <div className="rounded-md border overflow-hidden">
      <Table className={fontSize}>
        <TableHeader>
          <TableRow>
            <TableHead className={`${cellPadding} w-10`}>Pos.</TableHead>
            <TableHead className={cellPadding}>Équipe / Coureur</TableHead>
            <TableHead className={`${cellPadding} text-right w-12`}>Pts</TableHead>
            <TableHead className={`${cellPadding} w-16 text-right`}>Manager</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedTeams.flatMap((team) => {
            const teamKey = `${team.teamPosition}-${team.equipeIdUci}`;
            const isExpanded = expandedTeams.has(teamKey);
            
            const rows: React.ReactNode[] = [];
            
            // Team header row
            rows.push(
              <TableRow 
                key={`team-${teamKey}`}
                onClick={() => toggleTeam(teamKey)}
                className={`bg-muted/50 font-bold cursor-pointer hover:bg-muted/70 ${
                  team.hasMyRider ? "border-l-2 border-l-yellow-400" : ""
                }`}
              >
                <TableCell className={`${cellPadding} text-center font-medium`}>
                  <div className="flex items-center justify-center gap-1">
                    {team.teamPosition <= 3 && (
                      <span className="text-sm">
                        {team.teamPosition === 1 ? "🥇" : 
                         team.teamPosition === 2 ? "🥈" : "🥉"}
                      </span>
                    )}
                    <span>{team.teamPosition}</span>
                  </div>
                </TableCell>
                <TableCell className={cellPadding}>
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-bold truncate">{team.teamName}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 flex-shrink-0">
                      {team.riders.length} coureurs
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className={`${cellPadding} text-right font-bold tabular-nums`}>
                  {team.baremePoints > 0 ? team.baremePoints : "—"}
                </TableCell>
                <TableCell className={cellPadding} />
              </TableRow>
            );
            
            // Rider rows (only if expanded)
            if (isExpanded) {
              team.riders.forEach((rider) => {
                const statutBadge = getStatutBadge(rider.statut);
                
                rows.push(
                  <TableRow
                    key={rider.race_result_id}
                    className={
                      rider.is_my_rider 
                        ? "bg-yellow-100/60 dark:bg-yellow-900/20 border-l-2 border-l-yellow-400" 
                        : ""
                    }
                  >
                    <TableCell className={`${cellPadding} text-center`}>
                      {rider.statut === 'finished' && rider.position_decimal !== null ? (
                        <span className="text-muted-foreground text-xs">
                          {rider.position_decimal}
                        </span>
                      ) : statutBadge ? (
                        <Badge variant={statutBadge.variant} className="text-[9px] px-1">
                          {statutBadge.label}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className={`${cellPadding} pl-8`}>
                      <div className="flex flex-col">
                        <span className="font-semibold leading-tight truncate">{rider.coureur_nom}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`${cellPadding} text-right tabular-nums text-muted-foreground`}>
                      {rider.points_theoriques > 0 ? rider.points_theoriques.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className={`${cellPadding} text-right`}>
                      {rider.manager_nom && (
                        <span className="text-[9px] text-muted-foreground truncate block">
                          {rider.manager_nom}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              });
            }
            
            return rows;
          })}
        </TableBody>
      </Table>
    </div>
  );
};

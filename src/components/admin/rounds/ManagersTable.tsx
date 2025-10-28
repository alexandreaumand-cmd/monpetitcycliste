import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface ManagerStatus {
  manager_id: string;
  manager_nom: string;
  current_round_riders: number;
  current_round_budget: number;
  previous_rounds_riders: number;
  previous_rounds_budget: number;
  slots_missing: number;
  max_slots: number;
  budget_total: number;
  last_activity: string | null;
  riders_per_round: number[];
}

interface ManagersTableProps {
  managers: ManagerStatus[];
}

export function ManagersTable({ managers }: ManagersTableProps) {
  const getMissingBadgeVariant = (missing: number) => {
    if (missing === 0) return "default";
    if (missing > 5) return "destructive";
    return "secondary";
  };

  const formatBudget = (amount: number) => {
    return `${amount.toLocaleString('fr-FR')} M`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Manager</TableHead>
            <TableHead className="text-center">Coureurs tours précédents</TableHead>
            <TableHead className="text-center">Manque</TableHead>
            <TableHead className="text-right">Budget tour actuel</TableHead>
            <TableHead className="text-right">Budget tours précédents</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {managers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                Aucun manager trouvé
              </TableCell>
            </TableRow>
          ) : (
            managers.map((manager) => (
              <TableRow key={manager.manager_id}>
                <TableCell className="font-medium">{manager.manager_nom}</TableCell>
                <TableCell className="text-center">
                  {manager.previous_rounds_riders > 0 ? (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <button className="text-primary hover:underline cursor-help">
                          {manager.previous_rounds_riders}
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-64">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm mb-2">Détail par tour</h4>
                          {manager.riders_per_round.map((count, index) => (
                            count > 0 && (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tour {index + 1}:</span>
                                <span className="font-medium">{count} coureur{count > 1 ? 's' : ''}</span>
                              </div>
                            )
                          ))}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={getMissingBadgeVariant(manager.slots_missing)}>
                    {manager.slots_missing === 0 ? (
                      "Complet"
                    ) : (
                      `${manager.slots_missing}/${manager.max_slots}`
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="space-y-0.5">
                    <div className="text-sm">{manager.current_round_riders} coureur{manager.current_round_riders > 1 ? 's' : ''}</div>
                    <div className="text-xs text-muted-foreground">{formatBudget(manager.current_round_budget)}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">{formatBudget(manager.previous_rounds_budget)}</div>
                    <div className="text-xs text-muted-foreground">
                      Reste: {formatBudget(manager.budget_total - manager.previous_rounds_budget - manager.current_round_budget)}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

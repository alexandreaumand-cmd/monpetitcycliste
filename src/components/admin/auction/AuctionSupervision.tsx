import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount } from "@/lib/utils";
import { useManagerStatus } from "@/hooks/useManagerStatus";

interface AuctionSupervisionProps {
  activePhaseId: string | undefined;
}

export const AuctionSupervision = ({ activePhaseId }: AuctionSupervisionProps) => {
  const { managersStatus, getManagerStatus } = useManagerStatus(activePhaseId);

  if (!activePhaseId || managersStatus.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>État des managers - Round en cours</CardTitle>
        <CardDescription>
          Suivi de la soumission des enchères pour le round actif
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Manager</TableHead>
              <TableHead className="text-center">Slots restants</TableHead>
              <TableHead className="text-center">Enchères pending</TableHead>
              <TableHead className="text-center">Budget restant</TableHead>
              <TableHead className="text-center">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {managersStatus
              .sort((a, b) => {
                const statusA = getManagerStatus(a);
                const statusB = getManagerStatus(b);
                if (statusA.label === "En attente" && statusB.label !== "En attente") return -1;
                if (statusA.label !== "En attente" && statusB.label === "En attente") return 1;
                return a.manager_nom.localeCompare(b.manager_nom);
              })
              .map((manager) => {
                const status = getManagerStatus(manager);
                return (
                  <TableRow key={manager.manager_id}>
                    <TableCell className="font-medium">{manager.manager_nom}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{manager.slots_restants}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={manager.pending_count !== manager.slots_restants ? "text-orange-600" : "text-green-600"}>
                        {manager.pending_count} / {manager.slots_restants}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={Math.abs(parseFloat(manager.budget_restant.toString()) - parseFloat(manager.pending_sum.toString())) >= 1 ? "text-orange-600" : "text-green-600"}>
                        {formatAmount(manager.pending_sum)} / {formatAmount(manager.budget_restant)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={status.variant}
                        className="flex items-center gap-1 justify-center"
                      >
                        {status.icon}
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Rider {
  rider_id: string;
  rider_nom: string;
  rider_team: string;
  cote: number | null;
}

interface RiderResultsListProps {
  riders: Rider[];
  onAddRider: (rider: Rider) => void;
  isLoading?: boolean;
}

export function RiderResultsList({ riders, onAddRider, isLoading }: RiderResultsListProps) {
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (riders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-muted-foreground mb-2">Aucun coureur trouvé</p>
        <p className="text-sm text-muted-foreground">
          Essaie de modifier tes filtres
        </p>
      </div>
    );
  }

  return (
    <div className="border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead className="text-center">Équipe</TableHead>
            <TableHead className="text-right">Côte</TableHead>
            <TableHead className="text-center w-[100px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {riders.map((rider) => (
            <TableRow key={rider.rider_id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{rider.rider_nom}</TableCell>
              <TableCell className="text-center font-mono text-xs">
                {rider.rider_team || "N/A"}
              </TableCell>
              <TableCell className="text-right">
                {rider.cote !== null ? `${rider.cote}€` : "-"}
              </TableCell>
              <TableCell className="text-center">
                <Button
                  size={isMobile ? "sm" : "default"}
                  variant="outline"
                  onClick={() => onAddRider(rider)}
                >
                  <Plus className="h-4 w-4" />
                  {!isMobile && <span className="ml-1">Ajouter</span>}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

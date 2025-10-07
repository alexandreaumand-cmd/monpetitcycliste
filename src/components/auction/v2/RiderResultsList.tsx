import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  renderActionButton?: (rider: Rider) => React.ReactNode;
}

export function RiderResultsList({ riders, onAddRider, isLoading, renderActionButton }: RiderResultsListProps) {
  const isMobile = useIsMobile();
  const [sortColumn, setSortColumn] = useState<'nom' | 'cote' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: 'nom' | 'cote') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: 'nom' | 'cote') => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 inline" />
      : <ArrowDown className="h-4 w-4 ml-1 inline" />;
  };

  const sortedRiders = useMemo(() => {
    if (!sortColumn) return riders;
    
    return [...riders].sort((a, b) => {
      if (sortColumn === 'nom') {
        const comparison = a.rider_nom.localeCompare(b.rider_nom, 'fr');
        return sortDirection === 'asc' ? comparison : -comparison;
      } else if (sortColumn === 'cote') {
        const coteA = a.cote ?? 999999;
        const coteB = b.cote ?? 999999;
        return sortDirection === 'asc' ? coteA - coteB : coteB - coteA;
      }
      return 0;
    });
  }, [riders, sortColumn, sortDirection]);

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
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 select-none"
              onClick={() => handleSort('nom')}
            >
              Coureur
              {getSortIcon('nom')}
            </TableHead>
            <TableHead 
              className="text-right cursor-pointer hover:bg-muted/50 select-none"
              onClick={() => handleSort('cote')}
            >
              Côte
              {getSortIcon('cote')}
            </TableHead>
            <TableHead className="text-center w-[100px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRiders.map((rider) => (
            <TableRow key={rider.rider_id} className="hover:bg-muted/50">
              <TableCell className="font-medium py-1.5">
                <span>{rider.rider_nom}</span>
              </TableCell>
              <TableCell className="text-right py-1.5">
                {rider.cote !== null ? `${rider.cote}` : "-"}
              </TableCell>
              <TableCell className="text-center py-1.5">
                {renderActionButton ? (
                  renderActionButton(rider)
                ) : (
                  <Button
                    size={isMobile ? "sm" : "default"}
                    variant="outline"
                    onClick={() => onAddRider(rider)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

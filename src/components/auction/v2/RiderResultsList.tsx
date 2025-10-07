import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="p-3 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
              <div className="h-9 w-9 bg-muted rounded" />
            </div>
          </Card>
        ))}
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
    <div className={`space-y-2 ${isMobile ? 'p-3' : 'p-4'}`}>
      {riders.map((rider) => (
        <Card
          key={rider.rider_id}
          className="p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Team badge */}
            <Badge variant="outline" className="shrink-0 font-mono text-xs">
              {rider.rider_team || "N/A"}
            </Badge>

            {/* Rider info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{rider.rider_nom}</p>
              {rider.cote !== null && (
                <p className="text-sm text-muted-foreground">
                  Côte: {rider.cote}€
                </p>
              )}
            </div>

            {/* Add button */}
            <Button
              size={isMobile ? "sm" : "default"}
              variant="outline"
              onClick={() => onAddRider(rider)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              {!isMobile && <span className="ml-1">Ajouter</span>}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

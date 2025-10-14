import { Badge } from "@/components/ui/badge";
import { Clock, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface RoundHeaderProps {
  phaseName: string;
  phaseIndex: number;
  roundNumber: number;
  deadline: string | null;
  isOpen: boolean;
}

export const RoundHeader = ({ 
  phaseName, 
  phaseIndex, 
  roundNumber, 
  deadline, 
  isOpen 
}: RoundHeaderProps) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg border">
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-base px-3 py-1">
            Phase {phaseIndex}
          </Badge>
          <h2 className="text-2xl font-bold">Round {roundNumber}</h2>
          <Badge variant={isOpen ? "default" : "secondary"} className="gap-1">
            <Circle className={`h-2 w-2 ${isOpen ? 'fill-current animate-pulse' : ''}`} />
            {isOpen ? 'Ouvert' : 'Fermé'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{phaseName}</p>
      </div>
      
      {deadline && isOpen && (
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-muted-foreground">Deadline</p>
            <p className="font-medium">
              {formatDistanceToNow(new Date(deadline), { 
                addSuffix: true, 
                locale: fr 
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

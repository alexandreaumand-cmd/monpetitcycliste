import { Badge } from "@/components/ui/badge";
import { Clock, Circle } from "lucide-react";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RoundHeaderProps {
  phaseName: string;
  phaseIndex: number;
  roundNumber: number;
  deadline: string | null;
  isOpen: boolean;
  isScheduled?: boolean;
}

export const RoundHeader = ({ 
  phaseName, 
  phaseIndex, 
  roundNumber, 
  deadline, 
  isOpen,
  isScheduled = false
}: RoundHeaderProps) => {
  const hoursRemaining = deadline ? differenceInHours(new Date(deadline), new Date()) : null;
  const isUrgent = hoursRemaining !== null && hoursRemaining < 2;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg border">
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-base px-3 py-1">
            Phase {phaseIndex}
          </Badge>
          <h2 className="text-2xl font-bold">Round {roundNumber}</h2>
          <Badge 
            variant={isOpen ? "default" : isScheduled ? "outline" : "secondary"} 
            className="gap-1"
          >
            <Circle className={`h-2 w-2 ${isOpen ? 'fill-current animate-pulse' : ''}`} />
            {isOpen ? 'Ouvert' : isScheduled ? 'Programmé' : 'Fermé'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{phaseName}</p>
      </div>
      
      {deadline && isOpen && (
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors",
          isUrgent ? "bg-red-50 border-red-200" : "bg-background border-border"
        )}>
          <Clock className={cn(
            "h-6 w-6",
            isUrgent ? "text-red-600" : "text-muted-foreground"
          )} />
          <div>
            <p className={cn(
              "text-sm font-medium",
              isUrgent ? "text-red-600" : "text-muted-foreground"
            )}>
              Deadline
            </p>
            <p className={cn(
              "text-lg font-bold",
              isUrgent ? "text-red-700" : "text-foreground"
            )}>
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

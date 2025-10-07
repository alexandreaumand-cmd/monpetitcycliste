import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface AuctionHeaderProps {
  starting_budget: number;
  draft_sum: number;
  remaining_budget: number;
  budget_spent: number;
  currency: string;
  validation_status: {
    has_exact_slots: boolean;
    budget_fully_used: boolean;
    all_above_min: boolean;
    no_duplicates: boolean;
    no_taken_riders: boolean;
    can_submit: boolean;
  };
  draft_count: number;
  roster_count: number;
  max_slots: number;
  deadline_at?: string;
  validated_count?: number;
  total_managers?: number;
}

export function AuctionHeader({
  starting_budget,
  draft_sum,
  remaining_budget,
  budget_spent,
  currency,
  validation_status,
  draft_count,
  roster_count,
  max_slots,
  deadline_at,
  validated_count = 0,
  total_managers = 0,
}: AuctionHeaderProps) {
  const progressPercentage = ((budget_spent + draft_sum) / starting_budget) * 100;
  const allValid = validation_status.can_submit;
  
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (!deadline_at) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const deadline = new Date(deadline_at).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeRemaining("Terminé");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deadline_at]);

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 py-2 max-w-7xl">
        {/* Single compact line with all info */}
        <div className="flex items-center gap-6 text-sm">
          {/* Time - Far Left */}
          {deadline_at && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Fin:</span>
              <Badge variant="outline" className="font-mono">
                {timeRemaining}
              </Badge>
            </div>
          )}

          {/* Budget Progress */}
          <div className="flex items-center gap-3 flex-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Budget:</span>
            <div className="flex-1 max-w-xs">
              <Progress value={progressPercentage} className="h-2" />
            </div>
            <span className="text-xs font-medium whitespace-nowrap">
              {draft_sum}/{starting_budget}
            </span>
          </div>

          {/* Validated */}
          {total_managers > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">
                {validated_count}/{total_managers}
              </Badge>
            </div>
          )}

          {/* Validation Status */}
          <div className={`flex items-center gap-3 px-3 py-1.5 rounded-md border ${
            allValid ? 'border-green-500/50 bg-green-500/5' : 'border-orange-500/50 bg-orange-500/5'
          }`}>
            <div className="flex items-center gap-1.5 text-xs">
              {validation_status.has_exact_slots ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-orange-500" />
              )}
              <span className="text-muted-foreground">
                {roster_count + draft_count}/{max_slots}
              </span>
            </div>
            
            {allValid && (
              <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Prêt
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

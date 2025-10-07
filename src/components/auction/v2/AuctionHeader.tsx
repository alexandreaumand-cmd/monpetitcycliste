import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface AuctionHeaderProps {
  starting_budget: number;
  draft_sum: number;
  remaining_budget: number;
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
  currency,
  validation_status,
  draft_count,
  roster_count,
  max_slots,
  deadline_at,
  validated_count = 0,
  total_managers = 0,
}: AuctionHeaderProps) {
  const progressPercentage = (draft_sum / starting_budget) * 100;
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
      <div className="container mx-auto p-4 max-w-7xl space-y-3">
        {/* Top Row - Time & Stats */}
        <div className="flex items-center justify-between text-sm">
          {deadline_at && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Temps restant:</span>
              <Badge variant="outline" className="font-mono">
                {timeRemaining}
              </Badge>
            </div>
          )}
          {total_managers > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="font-medium">Validés:</span>
              <Badge variant="outline">
                {validated_count}/{total_managers}
              </Badge>
            </div>
          )}
        </div>

        {/* Main Row - Budget & Validation */}
        <div className="flex gap-4">
          {/* Budget Section - 60% */}
          <div className="flex-[3] space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Budget restant</h2>
              {validation_status.budget_fully_used ? (
                <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                  Budget OK
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-base px-3 py-1">
                  Reste: {remaining_budget}
                </Badge>
              )}
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{draft_sum}</span>
              <span>{starting_budget}</span>
            </div>
          </div>

          {/* Validation Section - 40% */}
          <div className={`flex-[2] border rounded-lg p-3 ${
            allValid ? 'border-green-500/50 bg-green-500/5' : 'border-orange-500/50 bg-orange-500/5'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Validation</h3>
              {allValid ? (
                <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Prêt
                </Badge>
              ) : (
                <Badge variant="secondary">
                  {roster_count + draft_count}/{max_slots}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {validation_status.has_exact_slots ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-orange-500" />
              )}
              <span>Coureurs</span>
              
              {validation_status.budget_fully_used ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-orange-500" />
              )}
              <span>Budget</span>
              
              {validation_status.all_above_min && validation_status.no_duplicates ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-orange-500" />
              )}
              <span>Montants</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

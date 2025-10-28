import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Clock, Users, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "react-router-dom";
import mpcLogo from "@/assets/mpc-logo.png";

interface AuctionHeaderMobileProps {
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

export function AuctionHeaderMobile({
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
}: AuctionHeaderMobileProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
    <div className="sticky top-0 z-10 bg-background">
      {/* Logo Header */}
      <div className="flex items-center justify-center py-2 border-b border-border/50 bg-background/95 backdrop-blur">
        <Link to="/dashboard/home" className="flex items-center">
          <img 
            src={mpcLogo} 
            alt="Logo Mon Petit Cycliste" 
            className="h-7 w-auto max-w-[180px]"
          />
        </Link>
      </div>
      
      {/* Existing Collapsible Header */}
      <Collapsible
        open={isExpanded}
        onOpenChange={setIsExpanded}
        className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
      {/* Compact Header - Always Visible */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Budget + Coureurs */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground leading-none">Budget</span>
              <span className="text-sm font-bold tabular-nums leading-tight">
                {remaining_budget}{currency}
              </span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground leading-none">Coureurs</span>
              <span className="text-sm font-bold tabular-nums leading-tight">
                {roster_count + draft_count}/{max_slots}
              </span>
            </div>
          </div>

          {/* Status + Expand Button */}
          <div className="flex items-center gap-2">
            {allValid ? (
              <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] px-1.5 py-0">
                <CheckCircle2 className="h-3 w-3 mr-0.5" />
                Prêt
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                En cours
              </Badge>
            )}
            
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-2 border-t">
          {/* Time & Stats */}
          <div className="flex items-center justify-between text-xs pt-2">
            {deadline_at && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-medium">Temps:</span>
                <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                  {timeRemaining}
                </Badge>
              </div>
            )}
            {total_managers > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3 w-3" />
                <span className="font-medium">Validés:</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {validated_count}/{total_managers}
                </Badge>
              </div>
            )}
          </div>

          {/* Budget Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Budget</span>
              {validation_status.budget_fully_used && (
                <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] px-1.5 py-0">
                  OK
                </Badge>
              )}
            </div>
            <Progress value={progressPercentage} className="h-1.5" />
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{draft_sum}</span>
              <span>{starting_budget}</span>
            </div>
          </div>

          {/* Validation Details */}
          <div className={`border rounded-md p-2 ${
            allValid ? 'border-green-500/50 bg-green-500/5' : 'border-orange-500/50 bg-orange-500/5'
          }`}>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
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
      </CollapsibleContent>
    </Collapsible>
    </div>
  );
}

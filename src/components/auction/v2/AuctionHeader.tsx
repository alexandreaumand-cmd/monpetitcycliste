import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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
  phase_index?: number;
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
  phase_index,
}: AuctionHeaderProps) {
  const { t } = useTranslation("auction");
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (!deadline_at) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const deadline = new Date(deadline_at).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeRemaining(t("finished"));
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
  }, [deadline_at, t]);

  const budgetProgress = ((budget_spent + draft_sum) / starting_budget) * 100;
  const slotsProgress = ((roster_count + draft_count) / max_slots) * 100;
  const totalSlots = roster_count + draft_count;

  const getBudgetColor = () => {
    if (remaining_budget < 0) return "destructive";
    if (remaining_budget < 50) return "default";
    return "secondary";
  };

  const getSlotsColor = () => {
    if (totalSlots === max_slots) return "default";
    if (totalSlots > max_slots * 0.8) return "secondary";
    return "outline";
  };

  return (
    <div className="sticky top-0 z-20 border-b bg-gradient-to-r from-background via-background/95 to-background backdrop-blur-sm shadow-sm safe-top">
      <div className="container mx-auto max-w-7xl px-4 py-4">
        {/* Phase indicator */}
        {phase_index && (
          <div className="mb-3">
            <Badge variant="outline" className="text-xs">
              {t("phase")} {phase_index}
            </Badge>
          </div>
        )}
        
        <div className="grid grid-cols-4 gap-4">
          {/* Timer */}
          {deadline_at && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border hover:border-primary/50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{t("timeRemaining")}</p>
                <p className="text-lg font-bold tracking-tight">{timeRemaining}</p>
              </div>
            </div>
          )}

          {/* Budget */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border hover:border-primary/50 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-xs text-muted-foreground font-medium">{t("budget.title")}</p>
                <Badge variant={getBudgetColor()} className="text-xs">
                  {remaining_budget}{currency}
                </Badge>
              </div>
              <Progress value={budgetProgress} className="h-1.5" />
            </div>
          </div>

          {/* Slots */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border hover:border-primary/50 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-xs text-muted-foreground font-medium">{t("slots.title")}</p>
                <Badge variant={getSlotsColor()} className="text-xs">
                  {totalSlots}/{max_slots}
                </Badge>
              </div>
              <Progress value={slotsProgress} className="h-1.5" />
            </div>
          </div>

          {/* Validation Status */}
          <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
            validation_status.can_submit 
              ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50' 
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50'
          }`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              validation_status.can_submit ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              {validation_status.can_submit ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("status.pending")}</p>
              <p className="text-sm font-semibold">
                {validation_status.can_submit ? (
                  <span className="text-green-600 dark:text-green-400">{t("status.ready")}</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">{t("status.incomplete")}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

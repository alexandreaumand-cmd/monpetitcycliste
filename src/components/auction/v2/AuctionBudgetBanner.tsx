import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface AuctionBudgetBannerProps {
  starting_budget: number;
  draft_sum: number;
  remaining_budget: number;
  currency: string;
  validation_status: {
    has_exact_slots: boolean;
    budget_fully_used: boolean;
  };
}

export function AuctionBudgetBanner({
  starting_budget,
  draft_sum,
  remaining_budget,
  currency,
  validation_status,
}: AuctionBudgetBannerProps) {
  const progressPercentage = (draft_sum / starting_budget) * 100;
  const isAlmostFull = progressPercentage > 90;
  const isBudgetValid = validation_status.budget_fully_used;

  return (
    <Card className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Budget restant</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm space-y-1">
                    <p>Budget initial: {starting_budget}{currency}</p>
                    <p>Enchères engagées: {draft_sum}{currency}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-2">
            {isBudgetValid && (
              <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                Budget OK
              </Badge>
            )}
            {!isBudgetValid && remaining_budget > 0 && (
              <Badge variant="secondary">
                Reste: {remaining_budget}{currency}
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Progress 
            value={progressPercentage} 
            className={isAlmostFull ? "bg-primary/20" : "bg-muted"}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{draft_sum}{currency} utilisés</span>
            <span>{starting_budget}{currency} total</span>
          </div>
        </div>

        {!isBudgetValid && remaining_budget !== 0 && (
          <p className="text-sm text-orange-500">
            {remaining_budget > 0 
              ? `Tu dois encore dépenser ${remaining_budget}${currency}` 
              : `Tu as dépassé de ${Math.abs(remaining_budget)}${currency}`}
          </p>
        )}
      </div>
    </Card>
  );
}

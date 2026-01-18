import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("auction");
  const progressPercentage = (draft_sum / starting_budget) * 100;
  const isAlmostFull = progressPercentage > 90;
  const isBudgetValid = validation_status.budget_fully_used;

  return (
    <Card className="sticky top-0 z-10 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t("budget.remaining")}</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm space-y-1">
                    <p>{t("budget.initial")}: {starting_budget}</p>
                    <p>{t("budget.committed")}: {draft_sum}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-2">
            {isBudgetValid && (
              <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                {t("budget.ok")}
              </Badge>
            )}
            {!isBudgetValid && remaining_budget > 0 && (
              <Badge variant="secondary">
                {t("budget.left")}: {remaining_budget}
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
            <span>{draft_sum} {t("budget.used")}</span>
            <span>{starting_budget} {t("budget.total")}</span>
          </div>
        </div>

        {!isBudgetValid && remaining_budget !== 0 && (
          <p className="text-sm text-orange-500">
            {remaining_budget > 0 
              ? t("budget.mustSpend", { amount: remaining_budget })
              : t("budget.exceeded", { amount: Math.abs(remaining_budget) })}
          </p>
        )}
      </div>
    </Card>
  );
}

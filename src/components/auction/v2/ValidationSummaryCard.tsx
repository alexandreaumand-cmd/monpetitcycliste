import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Circle } from "lucide-react";

interface ValidationStatus {
  has_exact_slots: boolean;
  budget_fully_used: boolean;
  all_above_min: boolean;
  no_duplicates: boolean;
  no_taken_riders: boolean;
  can_submit: boolean;
}

interface ValidationSummaryCardProps {
  validation_status: ValidationStatus;
  draft_count: number;
  max_slots: number;
  remaining_budget: number;
  currency: string;
}

export function ValidationSummaryCard({
  validation_status,
  draft_count,
  max_slots,
  remaining_budget,
  currency,
}: ValidationSummaryCardProps) {
  const checks = [
    {
      label: `${draft_count}/${max_slots} coureurs sélectionnés`,
      status: validation_status.has_exact_slots,
      critical: true,
    },
    {
      label: "Budget entièrement utilisé",
      status: validation_status.budget_fully_used,
      critical: true,
      detail: remaining_budget !== 0 ? `Reste: ${remaining_budget}` : undefined,
    },
    {
      label: "Tous les montants sont valides",
      status: validation_status.all_above_min,
      critical: true,
    },
    {
      label: "Aucun doublon",
      status: validation_status.no_duplicates,
      critical: true,
    },
    {
      label: "Coureurs disponibles",
      status: validation_status.no_taken_riders,
      critical: true,
    },
  ];

  const allValid = validation_status.can_submit;

  return (
    <Card className={`p-4 ${allValid ? 'border-green-500/50 bg-green-500/5' : 'border-orange-500/50 bg-orange-500/5'}`}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Validation des enchères</h3>
          {allValid ? (
            <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
              Prêt
            </Badge>
          ) : (
            <Badge variant="secondary">
              {draft_count}/{max_slots}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          {checks.map((check, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              {check.status ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              ) : check.critical ? (
                <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className={check.status ? "text-foreground" : "text-muted-foreground"}>
                  {check.label}
                </span>
                {check.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {!allValid && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Tu dois remplir tous les critères pour valider tes enchères
          </p>
        )}
      </div>
    </Card>
  );
}

import { Button } from "@/components/ui/button";
import { Save, X, Calculator } from "lucide-react";

interface Props {
  isDirty: boolean;
  pendingCount: number;
  saving: boolean;
  onSave: () => void;
  onCancelAll: () => void;
  onComputePoints: () => void;
}

export const ResultsEntryActions = ({
  isDirty,
  pendingCount,
  saving,
  onSave,
  onCancelAll,
  onComputePoints,
}: Props) => {
  return (
    <div className="sticky bottom-0 bg-background border-t p-4 flex gap-3 justify-end">
      <Button
        onClick={onSave}
        disabled={!isDirty || saving}
        className="gap-2"
      >
        <Save className="h-4 w-4" />
        Enregistrer {pendingCount > 0 && `(${pendingCount})`}
      </Button>

      <Button
        variant="outline"
        onClick={onCancelAll}
        disabled={!isDirty}
        className="gap-2"
      >
        <X className="h-4 w-4" />
        Annuler tout
      </Button>

      <Button
        variant="secondary"
        onClick={onComputePoints}
        className="gap-2"
      >
        <Calculator className="h-4 w-4" />
        Recalculer les points
      </Button>
    </div>
  );
};

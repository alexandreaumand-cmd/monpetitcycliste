import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ManagerSelect } from "@/components/shared/ManagerSelect";
import { ChevronLeft, Save } from "lucide-react";

type ManagerBonusType = 'ttt' | 'scoreurs';

interface ManagerBonusFormProps {
  bonusType: ManagerBonusType;
  onBack: () => void;
  onSubmit: (data: {
    target_manager_id: string;
    points: number;
    commentaire?: string;
  }) => void;
  isSubmitting: boolean;
}

const BONUS_LABELS: Record<ManagerBonusType, string> = {
  ttt: 'Contre-la-montre par Équipes (TTT)',
  scoreurs: 'Bonus Scoreurs',
};

export const ManagerBonusForm = ({ bonusType, onBack, onSubmit, isSubmitting }: ManagerBonusFormProps) => {
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [points, setPoints] = useState<string>('');
  const [commentaire, setCommentaire] = useState('');

  const handleSubmit = () => {
    if (!selectedManager || !points) return;

    onSubmit({
      target_manager_id: selectedManager,
      points: parseInt(points),
      commentaire: commentaire || undefined,
    });

    // Reset form
    setSelectedManager('');
    setPoints('');
    setCommentaire('');
  };

  const canSubmit = selectedManager && points;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">Bonus: {BONUS_LABELS[bonusType]}</h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="manager">Manager *</Label>
          <ManagerSelect
            value={selectedManager}
            onValueChange={setSelectedManager}
            placeholder="Sélectionner un manager..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="points">Points *</Label>
          <Input
            id="points"
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="30"
            min="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="commentaire">Commentaire (optionnel)</Label>
          <Textarea
            id="commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="TTT Tirreno-Adriatico"
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          <Save className="h-4 w-4 mr-2" />
          Enregistrer
        </Button>
      </div>
    </div>
  );
};

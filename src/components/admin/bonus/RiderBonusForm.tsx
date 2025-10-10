import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";
import { ChevronLeft, Plus, Save } from "lucide-react";

type RiderBonusType = 'first_win' | 'coureur_bonuse' | 'itt';

interface RiderBonusFormProps {
  bonusType: RiderBonusType;
  phaseId: string;
  onBack: () => void;
  onSubmit: (data: {
    coureur_id: string;
    manager_id: string;
    points: number;
    commentaire?: string;
  }) => void;
  isSubmitting: boolean;
}

const BONUS_LABELS: Record<RiderBonusType, string> = {
  first_win: 'First Win',
  coureur_bonuse: 'Coureur Bonusé',
  itt: 'Contre-la-montre Individuel (ITT)',
};

export const RiderBonusForm = ({ bonusType, phaseId, onBack, onSubmit, isSubmitting }: RiderBonusFormProps) => {
  const [selectedCoureur, setSelectedCoureur] = useState<any>(null);
  const [points, setPoints] = useState<string>('');
  const [commentaire, setCommentaire] = useState('');

  const handleSubmit = () => {
    if (!selectedCoureur || !points || !selectedCoureur.manager_id) return;

    onSubmit({
      coureur_id: selectedCoureur.id,
      manager_id: selectedCoureur.manager_id,
      points: parseInt(points),
      commentaire: commentaire || undefined,
    });

    // Reset form
    setSelectedCoureur(null);
    setPoints('');
    setCommentaire('');
  };

  const canSubmit = selectedCoureur && points && selectedCoureur.manager_id;

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
          <Label htmlFor="coureur">Coureur *</Label>
          <CoureursCombobox
            phaseId={phaseId}
            value={selectedCoureur?.id}
            onSelect={setSelectedCoureur}
            showManager={true}
          />
          {selectedCoureur && (
            <p className="text-sm text-muted-foreground">
              → {selectedCoureur.nom} ({selectedCoureur.equipe})
              {selectedCoureur.manager_nom && (
                <span className="ml-2">• Manager: {selectedCoureur.manager_nom}</span>
              )}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="points">Points *</Label>
          <Input
            id="points"
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="50"
            min="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="commentaire">Commentaire (optionnel)</Label>
          <Textarea
            id="commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Première victoire de la saison"
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

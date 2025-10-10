import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Star, Timer, Users, Target } from "lucide-react";

type BonusCategory = 'coureur' | 'manager';
type RiderBonusType = 'first_win' | 'coureur_bonuse' | 'itt';
type ManagerBonusType = 'ttt' | 'scoreurs';

export type BonusType = 
  | { category: 'coureur', type: RiderBonusType }
  | { category: 'manager', type: ManagerBonusType };

interface BonusTypeSelectorProps {
  onSelect: (bonus: BonusType) => void;
}

export const BonusTypeSelector = ({ onSelect }: BonusTypeSelectorProps) => {
  const riderBonuses = [
    { type: 'first_win' as const, label: 'First Win', icon: Trophy, description: 'Première victoire de la saison' },
    { type: 'coureur_bonuse' as const, label: 'Coureur Bonusé', icon: Star, description: 'Coureur avec bonus spécial' },
    { type: 'itt' as const, label: 'Contre-la-montre Individuel (ITT)', icon: Timer, description: 'Performance en CLM individuel' },
  ];

  const managerBonuses = [
    { type: 'ttt' as const, label: 'Contre-la-montre par Équipes (TTT)', icon: Users, description: 'Performance en CLM par équipes' },
    { type: 'scoreurs' as const, label: 'Bonus Scoreurs', icon: Target, description: 'Bonus pour meilleurs scoreurs' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Choisir le type de bonus à attribuer</h3>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">📝 BONUS COUREUR</h4>
          <div className="grid gap-2">
            {riderBonuses.map(({ type, label, icon: Icon, description }) => (
              <Button
                key={type}
                variant="outline"
                className="h-auto justify-start text-left p-4"
                onClick={() => onSelect({ category: 'coureur', type })}
              >
                <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">👤 BONUS MANAGER</h4>
          <div className="grid gap-2">
            {managerBonuses.map(({ type, label, icon: Icon, description }) => (
              <Button
                key={type}
                variant="outline"
                className="h-auto justify-start text-left p-4"
                onClick={() => onSelect({ category: 'manager', type })}
              >
                <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

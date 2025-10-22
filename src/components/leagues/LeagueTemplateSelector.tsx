import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEAGUE_TEMPLATES, type GameMode } from "@/lib/leagues/templates";
import { Check } from "lucide-react";

type LeagueTemplateSelectorProps = {
  selectedMode: GameMode | null;
  onSelect: (mode: GameMode) => void;
};

export function LeagueTemplateSelector({ selectedMode, onSelect }: LeagueTemplateSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {LEAGUE_TEMPLATES.map((template) => (
        <Card
          key={template.id}
          className={`p-4 cursor-pointer transition-all hover:border-primary ${
            selectedMode === template.id ? 'border-primary bg-primary/5' : ''
          }`}
          onClick={() => onSelect(template.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{template.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {template.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {template.playerCounts.join(', ')} joueurs
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Budget: {template.defaultBudget}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Max: {template.defaultMaxRiders} coureurs
                </Badge>
              </div>
            </div>
            {selectedMode === template.id && (
              <div className="ml-2 flex-shrink-0">
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

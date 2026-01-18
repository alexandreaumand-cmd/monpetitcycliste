import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueTemplates, type GameMode } from "@/lib/leagues/templates";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

type LeagueTemplateSelectorProps = {
  selectedMode: GameMode | null;
  onSelect: (mode: GameMode) => void;
};

export function LeagueTemplateSelector({ selectedMode, onSelect }: LeagueTemplateSelectorProps) {
  const { t } = useTranslation('leagues');
  const { data: templates, isLoading } = useQuery({
    queryKey: ['league-templates'],
    queryFn: getLeagueTemplates,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates?.map((template) => (
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
                  {template.playerCounts.join(', ')} {t('templates.players')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {t('templates.budget')}: {template.defaultBudget}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {t('templates.maxRiders')}: {template.defaultMaxRiders}
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

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTemplates, type GameMode } from "@/lib/leagues/templates";
import { Check, Calendar, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

type LeagueTemplateSelectorProps = {
  selectedMode: GameMode | null;
  onSelect: (mode: GameMode) => void;
};

const MODE_ICONS: Record<string, React.ElementType> = {
  five_phases: Calendar,
  per_course: MapPin,
};

export function LeagueTemplateSelector({ selectedMode, onSelect }: LeagueTemplateSelectorProps) {
  const { t } = useTranslation('leagues');
  const templates = getTemplates();

  return (
    <div className="grid grid-cols-1 gap-4">
      {templates.map((template) => {
        const Icon = MODE_ICONS[template.id] || Calendar;
        const isSelected = selectedMode === template.id;

        return (
          <Card
            key={template.id}
            className={`p-5 cursor-pointer transition-all hover:border-primary ${
              isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''
            }`}
            onClick={() => onSelect(template.id)}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">
                  {t(`templates.${template.id}.name`, template.name)}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t(`templates.${template.id}.description`, template.description)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">
                    3-10 {t('templates.players')}
                  </Badge>
                  {template.id === 'five_phases' && (
                    <>
                      <Badge variant="outline" className="text-xs">
                        {t('settings.budget')}: 2200
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {t('settings.maxRiders')}: 30
                      </Badge>
                    </>
                  )}
                  {template.id === 'per_course' && (
                    <Badge variant="outline" className="text-xs">
                      {t('templates.perCourse.budgetAuto', 'Budget auto selon courses')}
                    </Badge>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

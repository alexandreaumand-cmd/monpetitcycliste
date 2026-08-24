import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOwnedLeagues } from "@/hooks/useAdminOwnedLeagues";
import { Check, Users, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  selectedLeagueId: string | null;
  onSelect: (leagueId: string) => void;
};

export function LeagueSourceSelector({ selectedLeagueId, onSelect }: Props) {
  const { t } = useTranslation('leagues');
  const { data: leagues = [], isLoading } = useAdminOwnedLeagues();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (leagues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('clone.noSourceLeagues')}</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('clone.sourceDesc')}</p>
      <div className="space-y-2">
        {leagues.map((league) => {
          const isSelected = selectedLeagueId === league.id;
          return (
            <Card
              key={league.id}
              className={`p-3 cursor-pointer transition-all hover:border-primary ${
                isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''
              }`}
              onClick={() => onSelect(league.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{league.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {league.game_mode === 'per_course'
                        ? t('join.modePerCourse')
                        : t('join.modeFivePhases')}
                    </Badge>
                    {league.seasonYear && (
                      <Badge variant="outline" className="text-xs">
                        <Trophy className="h-3 w-3 mr-1" />
                        {league.seasonYear}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {league.memberCount}
                    </Badge>
                  </div>
                </div>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

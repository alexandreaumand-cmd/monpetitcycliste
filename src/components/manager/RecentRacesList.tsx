import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface RecentRacesListProps {
  races: any[];
  selectedCourse: any;
  onSelectCourse: (course: any) => void;
  loading: boolean;
}

export const RecentRacesList = ({ races, selectedCourse, onSelectCourse, loading }: RecentRacesListProps) => {
  if (loading) {
    return (
      <div className="w-1/3 border-r p-4">
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (races.length === 0) {
    return (
      <div className="w-1/3 border-r p-4 flex items-center justify-center text-muted-foreground">
        Aucune course avec résultats dans ce filtre
      </div>
    );
  }

  return (
    <ScrollArea className="w-1/3 border-r">
      <div className="p-4 space-y-2">
        {races.map((race) => (
          <Card
            key={race.course_id}
            className={cn(
              "p-4 cursor-pointer transition-colors hover:bg-accent",
              selectedCourse?.course_id === race.course_id && "bg-accent"
            )}
            onClick={() => onSelectCourse(race)}
          >
            <h4 className="font-semibold mb-2">{race.nom}</h4>
            
            <div className="text-sm text-muted-foreground mb-2">
              {format(new Date(race.date_debut), 'd MMM', { locale: fr })} → {format(new Date(race.date_fin), 'd MMM yyyy', { locale: fr })}
              <Badge variant="outline" className="ml-2">{race.categorie}</Badge>
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
              {race.types?.map((type: string) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type}
                </Badge>
              ))}
            </div>

            {race.has_points ? (
              <Badge variant="default" className="mt-2">
                Mes points : {race.my_points}
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-2">
                Points en attente de calcul
              </Badge>
            )}
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};

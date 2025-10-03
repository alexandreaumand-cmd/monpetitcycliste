import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Calendar, Trophy } from "lucide-react";

interface Race {
  course_id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  categorie: string;
  phase_id: string;
  last_result_at: string;
  types: string[];
  my_points: number;
  has_points: boolean;
}

interface Props {
  races: Race[];
  selectedCourseId: string | null;
  onSelectCourse: (courseId: string) => void;
  loading: boolean;
}

export const RecentRacesList = ({ races, selectedCourseId, onSelectCourse, loading }: Props) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dernières courses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (races.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dernières courses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Aucune course avec résultats dans ce filtre</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dernières courses ({races.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-3">
            {races.map((race) => (
              <div
                key={race.course_id}
                onClick={() => onSelectCourse(race.course_id)}
                className={cn(
                  "p-4 rounded-lg border cursor-pointer transition-colors",
                  selectedCourseId === race.course_id
                    ? "bg-primary/10 border-primary"
                    : "bg-card hover:bg-muted/50"
                )}
              >
                <div className="space-y-2">
                  <h3 className="font-semibold">{race.nom}</h3>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{race.date_debut} → {race.date_fin}</span>
                    <Badge variant="outline">{race.categorie}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {race.types.map((type) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>

                  {race.has_points ? (
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span>Mes points: {race.my_points}</span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Points en attente de calcul
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

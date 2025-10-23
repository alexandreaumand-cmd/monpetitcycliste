import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Trophy, Medal } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type RiderResult = {
  position: number;
  coureur_nom: string;
  coureur_equipe?: string;
  points: number;
};

type RaceWithResults = {
  course_id: string;
  course_nom: string;
  date_fin: string;
  total_points: number;
  top10: RiderResult[];
};

export function RecentResultsWidget() {
  const { data: racesWithResults, isLoading } = useQuery({
    queryKey: ['recent-results-top10'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('home-recent-results-top10', {
        body: { limit: 3 }
      });

      if (error) throw error;
      return data.races as RaceWithResults[];
    },
  });

  const getMedalIcon = (position: number) => {
    if (position === 1) return <Medal className="h-4 w-4 text-yellow-500 fill-yellow-500" />;
    if (position === 2) return <Medal className="h-4 w-4 text-gray-400 fill-gray-400" />;
    if (position === 3) return <Medal className="h-4 w-4 text-amber-600 fill-amber-600" />;
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Derniers résultats
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <Skeleton key={j} className="h-8 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !racesWithResults || racesWithResults.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun résultat récent
          </p>
        ) : (
          <div className="space-y-6">
            {racesWithResults.map((race) => (
              <div key={race.course_id} className="border-l-2 border-primary pl-4 space-y-3">
                {/* Race header */}
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">{race.course_nom}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {race.date_fin ? format(new Date(race.date_fin), 'dd MMMM yyyy', { locale: fr }) : 'Date inconnue'}
                  </div>
                </div>

                {/* Top 10 */}
                {race.top10.length > 0 ? (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                    {race.top10.map((rider) => (
                      <div
                        key={`${race.course_id}-${rider.position}`}
                        className="flex items-center justify-between text-xs hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-5 flex-shrink-0">
                            {getMedalIcon(rider.position) || (
                              <span className="text-muted-foreground font-medium">
                                {rider.position}
                              </span>
                            )}
                          </div>
                          <span className="font-medium truncate">
                            {rider.coureur_nom}
                          </span>
                          {rider.coureur_equipe && (
                            <span className="text-muted-foreground truncate hidden sm:inline text-xs">
                              ({rider.coureur_equipe})
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-primary flex-shrink-0 ml-2">
                          {rider.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Pas encore de résultats
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Trophy } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function RecentRacesWidget() {
  const { data: recentRaces, isLoading } = useQuery({
    queryKey: ['recent-races-widget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_home_recent_results')
        .select('*')
        .order('date_fin', { ascending: false })
        .limit(3);

      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Dernières courses
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : !recentRaces || recentRaces.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun résultat récent
          </p>
        ) : (
          <div className="space-y-4">
            {recentRaces.map((race) => (
              <div key={race.course_id} className="border-l-2 border-primary pl-3 space-y-1">
                <h4 className="font-semibold text-sm">{race.course_nom}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {race.date_fin ? format(new Date(race.date_fin), 'dd MMMM yyyy', { locale: fr }) : 'Date inconnue'}
                </div>
                {race.total_points > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {race.total_points} points distribués
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

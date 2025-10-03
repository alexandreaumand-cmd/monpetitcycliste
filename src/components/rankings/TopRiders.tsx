import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type TopRidersProps = {
  phaseId?: string | null;
  limit?: number;
};

export const TopRiders = ({ phaseId, limit = 20 }: TopRidersProps) => {
  const { data: riders, isLoading } = useQuery({
    queryKey: ["top-riders", phaseId, limit],
    queryFn: async () => {
      if (phaseId) {
        const { data, error } = await supabase
          .from("v_top_riders_by_phase")
          .select("*")
          .eq("phase_id", phaseId)
          .order("total_points", { ascending: false })
          .limit(limit);
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("v_top_riders_global")
          .select("*")
          .order("total_points", { ascending: false })
          .limit(limit);
        
        if (error) throw error;
        return data;
      }
    },
  });

  const maxPoints = riders?.[0]?.total_points || 1;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Top Coureurs
        </CardTitle>
        <CardDescription>
          {phaseId ? "Meilleurs coureurs de la phase" : "Meilleurs coureurs toutes phases"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {riders?.map((rider, idx) => {
            const progressPercent = (rider.total_points / maxPoints) * 100;
            
            return (
              <Card key={rider.coureur_id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{rider.coureur_nom}</p>
                      {rider.coureur_equipe && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {rider.coureur_equipe}
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant={idx < 3 ? "default" : "secondary"}
                      className="ml-2 shrink-0"
                    >
                      #{idx + 1}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Points</span>
                      <span className="font-bold">{rider.total_points}</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">
                      {rider.courses_count} {rider.courses_count > 1 ? 'courses' : 'course'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {!riders || riders.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun coureur classé
          </div>
        )}
      </CardContent>
    </Card>
  );
};

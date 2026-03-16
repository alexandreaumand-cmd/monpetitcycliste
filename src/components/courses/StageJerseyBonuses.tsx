import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface JerseyBonus {
  jersey_type: string;
  icon: string;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  manager_id: string | null;
  manager_nom: string | null;
  points: number;
  is_my_rider: boolean;
}

interface StageJerseyBonusesProps {
  courseId: string;
  etapeNumero: number;
}

export const StageJerseyBonuses = ({ courseId, etapeNumero }: StageJerseyBonusesProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["stage-jersey-bonuses", courseId, etapeNumero],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stage-jersey-bonuses', {
        body: {
          course_id: courseId,
          etape_numero: etapeNumero
        }
      });

      if (error) throw error;
      return data as { bonuses: JerseyBonus[] };
    },
    enabled: !!courseId && !!etapeNumero,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.bonuses || data.bonuses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mt-6 pt-6 border-t">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Bonus maillots pour cette étape</h3>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {data.bonuses.map((bonus) => (
          <div
            key={bonus.jersey_type}
            className={`
              rounded-lg border p-4 space-y-2 transition-all
              ${bonus.is_my_rider 
                ? 'bg-yellow-100/60 dark:bg-yellow-900/20 border-bordure-gold border-2' 
                : 'bg-card hover:bg-muted/50'}
            `}
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl">{bonus.icon}</span>
              <Badge variant="secondary" className="font-bold">
                +{bonus.points}
              </Badge>
            </div>
            
            <div className="space-y-1">
              <p className="font-semibold text-sm leading-tight">
                {bonus.coureur_nom}
              </p>
              
              {bonus.manager_nom && (
                <p className="text-xs text-muted-foreground">
                  {bonus.manager_nom}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

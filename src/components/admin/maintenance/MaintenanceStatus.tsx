import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertTriangle, RefreshCw, Play, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const STORAGE_KEY = "admin_maintenance_last_run";

export const MaintenanceStatus = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);

  const lastRunStr = localStorage.getItem(STORAGE_KEY);
  const lastRun = lastRunStr ? new Date(parseInt(lastRunStr)) : null;

  // Check for missing porteur points
  const { data: missingCourses, refetch: refetchMissing } = useQuery({
    queryKey: ['missing-porteur-points'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('find_courses_missing_porteur_points');
      if (error) throw error;
      return data as Array<{ course_id: string; course_nom: string; missing_count: number }>;
    },
  });

  const runMaintenance = async () => {
    setIsRunning(true);
    
    try {
      // Step 1: Auto-fix missing Porteur points
      const { data: fixData, error: fixError } = await supabase.functions.invoke(
        "auto-fix-missing-porteur-points"
      );

      if (fixError) throw fixError;

      // Step 2: Get active phase and recompute all points
      const { data: phasesData } = await supabase
        .from("phases")
        .select("id")
        .eq("statut", "active")
        .single();

      if (phasesData) {
        const { error: computeError } = await supabase.functions.invoke(
          "compute-points",
          { body: { phase_id: phasesData.id } }
        );

        if (computeError) throw computeError;
      }

      // Update last run timestamp
      localStorage.setItem(STORAGE_KEY, Date.now().toString());

      toast({
        title: "Maintenance terminée",
        description: `${fixData?.courses_processed || 0} courses traitées, ${fixData?.total_points_added || 0} points ajoutés.`,
      });

      // Refresh status
      refetchMissing();
    } catch (error: any) {
      toast({
        title: "Erreur de maintenance",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const hasMissingPoints = missingCourses && missingCourses.length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Statut de la maintenance automatique
          </CardTitle>
          <CardDescription>
            Surveillance et déclenchement manuel de la maintenance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Dernière exécution</p>
              <Badge variant={lastRun ? "default" : "secondary"} className="text-sm">
                {lastRun 
                  ? formatDistanceToNow(lastRun, { addSuffix: true, locale: fr })
                  : "Jamais exécutée"
                }
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Points Porteur</p>
              <Badge variant={hasMissingPoints ? "destructive" : "default"} className="text-sm">
                {hasMissingPoints ? (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {missingCourses.length} course(s) avec points manquants
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Tous les points présents
                  </>
                )}
              </Badge>
            </div>
          </div>

          {hasMissingPoints && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Courses avec points Porteur manquants :</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {missingCourses.slice(0, 5).map((c) => (
                    <li key={c.course_id}>
                      {c.course_nom} ({c.missing_count} résultats)
                    </li>
                  ))}
                  {missingCourses.length > 5 && (
                    <li className="text-muted-foreground">
                      ... et {missingCourses.length - 5} autres
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={runMaintenance}
            disabled={isRunning}
            className="w-full"
            variant={hasMissingPoints ? "destructive" : "default"}
          >
            {isRunning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Maintenance en cours...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Lancer la maintenance maintenant
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            La maintenance vérifie et corrige automatiquement les points Porteur manquants,
            puis recalcule tous les points de la phase active.
          </p>
        </CardContent>
      </Card>
    </>
  );
};

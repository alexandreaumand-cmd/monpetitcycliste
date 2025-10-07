import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "admin_maintenance_last_run";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export const AdminMaintenance = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [isRunning, setIsRunning] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [missingCourses, setMissingCourses] = useState<Array<{ course_id: string; course_nom: string; missing_count: number }>>([]);

  useEffect(() => {
    if (!isAdmin || roleLoading) return;

    const shouldRun = checkShouldRun();
    if (shouldRun) {
      runMaintenance();
    }
  }, [isAdmin, roleLoading]);

  const checkShouldRun = (): boolean => {
    const lastRun = localStorage.getItem(STORAGE_KEY);
    if (!lastRun) return true;

    const lastRunTime = parseInt(lastRun, 10);
    const now = Date.now();
    return now - lastRunTime > COOLDOWN_MS;
  };

  const runMaintenance = async () => {
    setIsRunning(true);
    console.log("🔧 Starting admin maintenance...");

    try {
      // Step 1: Auto-fix missing Porteur points
      console.log("Step 1: Fixing missing Porteur points...");
      const { data: fixData, error: fixError } = await supabase.functions.invoke(
        "auto-fix-missing-porteur-points"
      );

      if (fixError) throw fixError;

      console.log("✅ Auto-fix result:", fixData);

      // Step 2: Get active phase and recompute all points
      console.log("Step 2: Recomputing points for active phase...");
      const { data: phasesData } = await supabase
        .from("phases")
        .select("id")
        .eq("statut", "active")
        .single();

      if (phasesData) {
        const { data: computeData, error: computeError } = await supabase.functions.invoke(
          "compute-points",
          { body: { phase_id: phasesData.id } }
        );

        if (computeError) throw computeError;
        console.log("✅ Recompute result:", computeData);
      }

      // Step 3: Verify if any missing points remain
      console.log("Step 3: Verifying remaining missing points...");
      const { data: checkData, error: checkError } = await supabase.rpc(
        "find_courses_missing_porteur_points"
      );

      if (checkError) throw checkError;

      if (checkData && checkData.length > 0) {
        console.warn("⚠️ Still missing Porteur points:", checkData);
        setMissingCourses(checkData);
        setShowAlert(true);
      } else {
        console.log("✅ All Porteur points are present!");
        toast({
          title: "Maintenance terminée",
          description: `${fixData?.courses_processed || 0} courses traitées, ${fixData?.total_points_added || 0} points ajoutés.`,
        });
      }

      // Update last run timestamp
      localStorage.setItem(STORAGE_KEY, Date.now().toString());

      // Refresh page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("❌ Maintenance error:", error);
      toast({
        title: "Erreur de maintenance",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (!isAdmin || roleLoading) return null;

  if (isRunning) {
    return (
      <Alert className="mb-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Maintenance en cours...</AlertTitle>
        <AlertDescription>
          Vérification et correction automatique des points Porteur. Veuillez patienter...
        </AlertDescription>
      </Alert>
    );
  }

  if (showAlert && missingCourses.length > 0) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Points Porteur manquants détectés</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            {missingCourses.length} course(s) ont encore des points Porteur manquants :
          </p>
          <ul className="list-disc list-inside mb-3 text-sm">
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              runMaintenance();
            }}
          >
            Relancer la réparation
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

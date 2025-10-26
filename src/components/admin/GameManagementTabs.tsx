import { RoundControlCenter } from "./RoundControlCenter";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export const GameManagementTabs = () => {
  const { leagueId } = useLeague();
  const { isLeagueAdminOnly } = useUserRole();

  if (isLeagueAdminOnly && !leagueId) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Veuillez sélectionner une ligue dans l'onglet "Ligues" pour gérer les enchères.
        </AlertDescription>
      </Alert>
    );
  }

  return <RoundControlCenter />;
};

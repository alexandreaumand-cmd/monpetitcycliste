import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MemberWriteGuardProps {
  children: React.ReactNode;
}

export function MemberWriteGuard({ children }: MemberWriteGuardProps) {
  const { leagueId, isLegacy } = useLeague();
  const { roles, isLoading } = useUserLeagues();

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  // Si Legacy, autoriser (compatibilité)
  if (isLegacy || !leagueId) {
    return <>{children}</>;
  }

  const canWrite = !!roles[leagueId];
  
  if (!canWrite) {
    return (
      <Alert variant="destructive">
        <Shield className="h-4 w-4" />
        <AlertTitle>Accès restreint</AlertTitle>
        <AlertDescription>
          Vous devez être membre de cette ligue pour effectuer des actions. 
          Rejoignez d'abord la ligue pour participer aux enchères.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
